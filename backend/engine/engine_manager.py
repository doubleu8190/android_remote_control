import os
from typing import Dict, List
from sqlalchemy.orm import Session
from backend.engine.engine import AIEngine
from langchain_openai import ChatOpenAI
from langchain_community.tools import Tool
from backend.model.models_db import Message as DBMessage

# 导入配置加载器
from backend.config.config_loader import engine_config
from .middleware import monitor_tool, monitor_model
from backend.model.models_db import Session as DBSession
from backend.infra.session_history_manager import session_history_manager
import logging


# 导入service层（如果存在）
try:
    from backend.infra.mcp_service import MCPService

    HAS_SERVICE_LAYER = True
except ImportError:
    HAS_SERVICE_LAYER = False
    print("Warning: Service layer not found. Using basic AI engine.")


class AIEngineManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'session_to_engine'):
            self.session_to_engine: Dict[str, AIEngine] = {}

    def clear_all_session_engines(self):
        """清除所有会话的引擎"""
        self.session_to_engine.clear()

    def clear_session_engine(self, session_id: str):
        """清除特定会话的引擎"""
        if session_id in self.session_to_engine:
            del self.session_to_engine[session_id]

    def get_or_create_engine(self, session: DBSession, db_session: Session = None) -> AIEngine | None:
        """获取会话特定的AI引擎"""
        engine = self.session_to_engine.get(session.id)
        if not engine:
            engine = self.create_engine(session, db_session)
        return engine

    def create_engine(
        self, session: DBSession, db_session: Session = None
    ) -> AIEngine | None:
        """获取或创建会话特定的AI引擎"""
        try:
            # 确保会话历史管理器已初始化
            if db_session:
                session_history_manager.create_session_history(session.id, db_session)
            # 从配置文件获取LLM配置
            openai_config = engine_config.get_config("llm.openai", {})
            base_llm = ChatOpenAI(
                api_key=session.api_key,
                base_url=session.base_url,
                model=session.model_name,
                temperature=openai_config.get("temperature", 0.7),
                max_tokens=openai_config.get("max_tokens", 1000),
                timeout=openai_config.get("timeout", 30),
                max_retries=openai_config.get("max_retries", 3),
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            base_tools = self.create_tools(session)
            system_prompt = self.create_system_instruction()
            
            # 创建引擎
            engine = AIEngine(
                session_id=session.id,
                llm=base_llm,
                tools=base_tools,
                system_prompt=system_prompt,
            )
            self.session_to_engine[session.id] = engine
            return engine
        except Exception as e:
            logging.error(f"ChatOpenAI 初始化失败: {e}")
            return None

    def create_tools(self, session: DBSession) -> List[Tool]:
        """创建会话特定的工具"""
        return []

    def create_system_instruction(self) -> str:
        """构建会话特定的系统提示词"""
        config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config')
        prompt_path = os.path.join(config_dir, 'system_prompt.txt')
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            logging.warning(f"系统提示词文件不存在: {prompt_path}，使用默认提示词")
            return (
                "你是一个AI助手，需要根据用户的输入和历史对话来生成响应。\n"
                "请以JSON格式输出你的响应。"
            )
        except Exception as e:
            logging.error(f"读取系统提示词文件失败: {e}，使用默认提示词")
            return (
                "你是一个AI助手，需要根据用户的输入和历史对话来生成响应。\n"
                "请以JSON格式输出你的响应。"
            )


engine_manager = AIEngineManager()
