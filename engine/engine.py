"""
简化版AI引擎，兼容LangChain 1.x
提供基本的协调、分发和决策功能
"""

from langchain_core.language_models import BaseLanguageModel
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from typing import List, Dict
import os
import logging

output_parser = JsonOutputParser()

class AIEngine:
    """
    AI引擎：协调用户输入、系统指令和历史对话
    """
    def __init__(self, llm: BaseLanguageModel, tools: List[BaseTool] = None, history: List[Dict[str, str]] = None, system_prompt_file: str = None):
        self.llm = llm
        self.tools = tools or []
        self.history: List[Dict[str, str]] = history or []  # 简单的历史记录
        
        # 从外部文件读取系统提示词
        if system_prompt_file and os.path.exists(system_prompt_file):
            try:
                with open(system_prompt_file, 'r', encoding='utf-8') as f:
                    self.system_instruction = f.read().strip()
                logging.info(f"成功从文件加载系统提示词: {system_prompt_file}")
            except Exception as e:
                logging.error(f"读取系统提示词文件失败: {e}")
                self.system_instruction = "你是一个AI助手，需要根据用户的输入和历史对话来生成响应。必要时可以使用工具来获取信息。"
        else:
            self.system_instruction = "你是一个AI助手，需要根据用户的输入和历史对话来生成响应。必要时可以使用工具来获取信息。"
    
    def _format_history(self) -> str:
        """格式化历史对话"""
        if not self.history:
            return "无历史对话"
        
        formatted = []
        for msg in self.history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            formatted.append(f"{role}: {content}")
        
        return "\n".join(formatted)
    
    def _format_tools(self) -> str:
        """格式化工具描述"""
        if not self.tools:
            return "无可用工具"
        
        tool_descs = []
        for i, tool in enumerate(self.tools):
            tool_descs.append(f"{i+1}. {tool.name}: {tool.description}")
        
        return "\n".join(tool_descs)
    
    def _create_prompt(self, user_input: str) -> ChatPromptTemplate:
        """创建提示模板"""
        history = self._format_history()
        tools = self._format_tools()
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_instruction),
            ("system", f"历史对话:\n{history}"),
            ("system", f"可用工具:\n{tools}"),
            ("system", "请以JSON格式输出你的响应，确保输出是有效的JSON字符串。"),
            ("human", user_input)
        ])
        
        return prompt
    
    def _call_tool(self, tool_name: str, tool_input: str) -> str:
        """调用工具"""
        for tool in self.tools:
            if tool.name == tool_name:
                try:
                    result = tool.invoke(tool_input)
                    return str(result)
                except Exception as e:
                    return f"工具调用错误: {str(e)}"
        
        return f"未找到工具: {tool_name}"
    
    def _extract_tool_calls(self, response: str) -> List[Dict[str, str]]:
        """
        从响应中提取工具调用（简化版）
        预期格式: { "content": "你的回复", "tool": "tool name", "tool_args": ["arg1", "arg2"] }
        """
        tool_calls = []
        lines = response.split('\n')
        for line in lines:
            if line.startswith("TOOL:"):
                parts = line.split("INPUT:")
                if len(parts) == 2:
                    tool_name = parts[0].replace("TOOL:", "").strip()
                    tool_input = parts[1].strip()
                    tool_calls.append({
                        "tool_name": tool_name,
                        "tool_input": tool_input
                    })
        return tool_calls
    
    def run(self, user_input: str) -> str:
        """
        运行引擎，处理用户输入并返回响应
        """
        
        # 创建提示
        prompt = self._create_prompt(user_input)
        
        # 创建链
        chain = prompt | self.llm | output_parser
        
        try:
            # 获取初始响应
            response = chain.invoke({})
            logging.info(f"初始响应: {response}")
            # 添加用户输入到历史
            self.history.append({"role": "user", "content": user_input})

            # 检查是否需要工具调用
            tool_calls = self._extract_tool_calls(response)
            
            if tool_calls:
                # 处理工具调用
                tool_results = []
                for tool_call in tool_calls:
                    tool_name = tool_call["tool_name"]
                    tool_input = tool_call["tool_input"]
                    result = self._call_tool(tool_name, tool_input)
                    tool_results.append(f"{tool_name}: {result}")
                
                # 创建包含工具结果的提示
                tool_results_str = "\n".join(tool_results)
                followup_prompt = ChatPromptTemplate.from_messages([
                    ("system", self.system_instruction),
                    ("system", f"历史对话:\n{self._format_history()}"),
                    ("human", user_input),
                    ("ai", response),
                    ("system", f"工具执行结果:\n{tool_results_str}"),
                    ("human", "请基于工具执行结果生成最终响应")
                ])
                
                followup_chain = followup_prompt | self.llm | StrOutputParser()
                final_response = followup_chain.invoke({})
                
                # 添加AI响应到历史
                self.history.append({"role": "assistant", "content": final_response})
                return final_response
            else:
                # 添加AI响应到历史
                self.history.append({"role": "assistant", "content": response})
                return response
                
        except Exception as e:
            error_msg = f"引擎处理错误: {str(e)}"
            return error_msg
    
    def add_tool(self, tool: BaseTool) -> None:
        """添加工具"""
        self.tools.append(tool)
    
    def clear_history(self) -> None:
        """清除历史对话"""
        self.history.clear()
    
    def get_history(self) -> List[Dict[str, str]]:
        """获取历史对话"""
        return self.history.copy()


class EngineBuilder:
    """
    引擎构建器，用于配置和创建AIEngine实例
    """
    def __init__(self):
        self.llm = None
        self.tools = []
        self.system_prompt_file = None
    
    def with_llm(self, llm: BaseLanguageModel) -> 'EngineBuilder':
        self.llm = llm
        return self
    
    def with_tool(self, tool: BaseTool) -> 'EngineBuilder':
        self.tools.append(tool)
        return self
    
    def with_tools(self, tools: List[BaseTool]) -> 'EngineBuilder':
        self.tools.extend(tools)
        return self

    def with_history(self, history: List[Dict[str, str]]) -> 'EngineBuilder':
        self.history = history
        return self
    
    def with_system_prompt_file(self, system_prompt_file: str) -> 'EngineBuilder':
        self.system_prompt_file = system_prompt_file
        return self
    
    def build(self) -> AIEngine:
        if not self.llm:
            raise ValueError("LLM必须提供")
        return AIEngine(llm=self.llm, tools=self.tools, history=self.history, system_prompt_file=self.system_prompt_file)
