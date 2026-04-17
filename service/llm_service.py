from langchain.llms import BaseLLM, OpenAI
from langchain.chat_models import ChatOpenAI
from typing import Dict, Any, Optional


class LLMService:
    """
    大模型服务，负责统一调用各种大模型API
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.llms = {}

    def get_llm(self, model_name: str = "openai") -> BaseLLM:
        """
        获取指定的大模型实例
        """
        if model_name not in self.llms:
            self.llms[model_name] = self._create_llm(model_name)
        return self.llms[model_name]

    def _create_llm(self, model_name: str) -> BaseLLM:
        """
        创建大模型实例
        """
        if model_name == "openai":
            return OpenAI(
                api_key=self.config.get("openai_api_key"),
                temperature=self.config.get("temperature", 0.7),
                max_tokens=self.config.get("max_tokens", 1000)
            )
        elif model_name == "chatgpt":
            return ChatOpenAI(
                api_key=self.config.get("openai_api_key"),
                temperature=self.config.get("temperature", 0.7),
                max_tokens=self.config.get("max_tokens", 1000)
            )
        else:
            raise ValueError(f"Unsupported model: {model_name}")

    def generate(self, prompt: str, model_name: str = "openai") -> str:
        """
        生成文本
        """
        llm = self.get_llm(model_name)
        return llm(prompt)

    def chat(self, messages: list, model_name: str = "chatgpt") -> str:
        """
        聊天模式
        """
        llm = self.get_llm(model_name)
        return llm(messages)


# 单例模式
llm_service = LLMService()