"""
简化版AI引擎，兼容LangChain 1.x
提供基本的协调、分发和决策功能
"""

from langchain_core.language_models import BaseLanguageModel
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.messages import SystemMessage, ToolMessage
from ..infra.session_history_manager import session_history_manager
from typing import Any, List, Dict, Generator
import json
import logging


class AIEngine:
    """
    AI引擎：协调用户输入、系统指令和历史对话
    """

    def __init__(
        self,
        session_id: str,
        llm: BaseLanguageModel,
        tools: List[BaseTool] = None,
        system_prompt: str = None,
    ):
        self.session_id = session_id
        self.llm = llm
        self.tools = tools or []
        self.tool_by_name = {tool.name: tool for tool in self.tools}
        self.system_instruction: str = system_prompt or ""
        self.prompt: ChatPromptTemplate = None
        self.conversation: RunnableWithMessageHistory = None
        self.config: Dict[str, Any] = None
        self.initialized = False

    def initialize(self):
        """
        初始化会话历史
        """
        if self.initialized:
            return
        logging.info(f"Initializing AIEngine for session {self.session_id}")
        # 1. 定义提示模板，包含历史消息的占位符
        self.prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=self.system_instruction),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{input}"),
            ]
        )
        logging.info(f"Prompt template created: {self.prompt}")
        # 2. 绑定工具到模型（仅在存在工具时）
        if self.tools:
            self.llm = self.llm.bind_tools(self.tools)

        logging.info(f"LLM bound with tools: {self.tools}")
        # 3. 创建链
        chain = self.prompt | self.llm 

        # 4. 使用RunnableWithMessageHistory包装链条，注入历史管理能力，
        # RunnableWithMessageHistory._exit_history 会自动保存 input + output
        self.conversation = RunnableWithMessageHistory(
            runnable=chain,
            get_session_history=session_history_manager.get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )
        logging.info(f"Conversation chain created with RunnableWithMessageHistory: {self.conversation}")
        # 4. 传递会话ID到模型调用
        self.config = {"configurable": {"session_id": self.session_id}}

        self.initialized = True
        logging.info(f"Initialized AIEngine for session {self.session_id}")

    def call_tool(self, tc: Any) -> ToolMessage:
        tool_name = tc["name"]
        tool_args = tc["args"]
        try:
            tool_result = self.tool_by_name[tool_name].invoke(tool_args)
        except Exception as e:
            tool_result = f"工具调用失败：{str(e)}"
        return ToolMessage(content=tool_result, tool_call_id=tc["id"], name=tool_name)

    def chat(self, user_input: str) -> str:
        """
        运行引擎，处理用户输入并返回响应
        """
        self.initialize()

        history = session_history_manager.get_session_history(self.session_id)

        try:
            logging.info(f"AIEngine received input for session {self.session_id}: {user_input}")
            # 1. 进行带记忆的对话（RunnableWithMessageHistory 自动保存输入输出到历史）
            response = self.conversation.invoke({"input": user_input}, config=self.config)
            logging.info(f"AIEngine response for session {self.session_id}: {response}")
        except Exception as e:
            logging.error(f"Error during conversation invoke: {e}")
            return f"对话处理失败：{str(e)}"

        # 2. 检查是否有 tool_calls，最多循环 10 次
        max_iterations = 10
        iteration = 0

        while response.tool_calls and iteration < max_iterations:
            iteration += 1
            # 对于每个 tool_call，执行工具并创建 ToolMessage
            for tc in response.tool_calls:
                tool_msg = self.call_tool(tc)
                # ToolMessage 需要手动添加到历史（RunnableWithMessageHistory 不处理）
                if history:
                    history.add_message(tool_msg)

            try:
                # 重新调用模型，将工具结果纳入上下文
                response = self.conversation.invoke(
                    {"input": ""},
                    config=self.config,
                )
            except Exception as e:
                logging.error(f"Error during conversation invoke: {e}")
                return f"工具调用对话处理失败：{str(e)}"

        return response.content

    def _stream_llm(self, input_data: dict) -> Generator[dict, None, Any]:
        """Stream LLM response, yield text events, return accumulated AIMessage via StopIteration."""
        full = None
        for chunk in self.conversation.stream(input_data, config=self.config):
            full = chunk if full is None else full + chunk
            if chunk.content:
                yield {"type": "text", "data": chunk.content}
        return full

    def _consume_stream(self, input_data: dict) -> Any:
        """Consume _stream_llm generator and extract the return value."""
        gen = self._stream_llm(input_data)
        try:
            while True:
                yield next(gen)
        except StopIteration as e:
            return e.value

    def chat_stream(self, user_input: str) -> Generator[dict, None, None]:
        """
        Process user input and yield streaming events for real-time frontend updates.

        Uses LangChain's stream() to yield LLM text tokens as they are generated.
        For tool calls, accumulates the streamed chunks to detect and handle them.

        Yields dicts with keys:
            type: 'tool_call' | 'tool_result' | 'text' | 'error' | 'done'
            data: str (JSON-encoded for tool events)
            message_id: str (tool call ID, for matching calls to results)
        """
        self.initialize()
        history = session_history_manager.get_session_history(self.session_id)

        try:
            gen = self._consume_stream({"input": user_input})
            while True:
                yield next(gen)
        except StopIteration as e:
            response = e.value
        except Exception as e:
            yield {"type": "error", "data": str(e)}
            return

        max_iterations = 10
        iteration = 0

        while response and response.tool_calls and iteration < max_iterations:
            iteration += 1

            # Yield tool call events before executing
            for tc in response.tool_calls:
                yield {
                    "type": "tool_call",
                    "data": json.dumps({"name": tc["name"], "args": tc["args"]}),
                    "message_id": tc.get("id", ""),
                }

            # Execute tools and yield results
            for tc in response.tool_calls:
                try:
                    tool_msg = self.call_tool(tc)
                    yield {
                        "type": "tool_result",
                        "data": tool_msg.content,
                        "message_id": tc.get("id", ""),
                    }
                    if history:
                        history.add_message(tool_msg)
                except Exception as e:
                    yield {
                        "type": "tool_result",
                        "data": json.dumps({"error": str(e)}),
                        "message_id": tc.get("id", ""),
                    }

            # Re-invoke the model with tool results (streaming)
            try:
                gen = self._consume_stream({"input": ""})
                while True:
                    yield next(gen)
            except StopIteration as e:
                response = e.value
            except Exception as e:
                yield {"type": "error", "data": str(e)}
                return

        # Yield the final full text content so the frontend has the definite version
        if response and response.content:
            yield {"type": "text", "data": response.content}
        yield {"type": "done", "data": ""}
