"""
简化版AI引擎，兼容LangChain 1.x
提供基本的协调、分发和决策功能
"""

from langchain_core.language_models import BaseLanguageModel
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from ..infra.session_history_manager import session_history_manager
from typing import Any, List, Dict
import os
import logging

output_parser = JsonOutputParser()


class AIEngine:
    """
    AI引擎：协调用户输入、系统指令和历史对话
    """

    def __init__(
        self,
        session_id: str,
        llm: BaseLanguageModel,
        tools: List[BaseTool] = None,
        history: List[Dict[str, str]] = None,
        system_prompt_file: str = None,
    ):
        self.session_id = session_id
        self.llm = llm
        self.tools = tools or []
        self.tool_by_name = {tool.name: tool for tool in tools}
        self.system_instruction: str = ""
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

        # 1. 定义提示模板，包含历史消息的占位符
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self.system_instruction),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{user_input}"),
            ]
        )

        # 2. 创建链
        chain = self.prompt | self.llm | output_parser

        # 3. 使用RunnableWithMessageHistory包装链条，注入历史管理能力
        self.conversation = RunnableWithMessageHistory(
            runnable=chain,
            get_session_history=session_history_manager.get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

        # 4. 传递会话ID到模型调用
        self.config = {"configurable": {"session_id": self.session_id}}

        # 5. 绑定工具到模型
        # 注意：这需要在模型初始化后调用，否则会报错
        self.llm = self.llm.bind_tools(self.tools)

        self.initialized = True

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

        # 1.进行带记忆的对话
        response = self.conversation.invoke({"input": user_input}, config=self.config)
        logging.info(f"llm response:{response.content}")
        history.add_message(response)
        
        # 2. 检查是否有 tool_calls
        while response.tool_calls:
            # 对于每个 tool_call，执行工具并创建 ToolMessage
            for tc in response.tool_calls:
                tool_msg = self.call_tool(tc)
                # 将 ToolMessage 直接添加到历史中
                history.add_message(tool_msg)

            # 重新调用模型，将工具结果纳入上下文
            # 注意：此时需要传入空输入，或者再次使用 conversation 但带一个空字符串
            # 由于 conversation 期望输入字典，我们直接调用 chain 并传入当前完整历史
            new_response = self.conversation.invoke(
                {
                    "input": "",  # 没有新用户输入
                },
                config=self.config,
            )
            # 将新的 AI 消息（可能还有更多 tool_calls 或最终答案）存入历史
            history.add_message(new_response)
            response = new_response

        return response.content
