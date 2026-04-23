from typing import Dict, Optional
from backend.engine.engine import AIEngine, EngineBuilder
from langchain_openai import ChatOpenAI
from langchain_community.tools import Tool
from backend.infra.database import get_db
from backend.model.models_db import Message as DBMessage
# 导入配置加载器
from backend.config.config_loader import engine_config
from .middleware import monitor_tool, monitor_model
import os
import uuid
import logging


# 导入service层（如果存在）
try:
    from backend.infra.mcp_service import MCPService

    HAS_SERVICE_LAYER = True
except ImportError:
    HAS_SERVICE_LAYER = False
    print("Warning: Service layer not found. Using basic AI engine.")


class AIEngineWrapper:
    """AI引擎包装器，为每个用户管理AI引擎实例，每个会话有独立的引擎"""

    def __init__(self, user_id: str, engine_id: Optional[str] = None):
        self.user_id = user_id
        self.engine_id = engine_id or str(uuid.uuid4())
        self.session_engines: Dict[str, AIEngine] = {}  # session_id -> engine
        self.initialized = False
        self.base_llm = None
        self.base_tools = []
        self.middleware = [monitor_tool, monitor_model]

    def initialize(self):
        """初始化AI引擎（创建基础LLM和工具）"""
        if self.initialized:
            return

        try:
            # 从配置文件获取LLM配置
            openai_config = engine_config.get_config("llm.openai", {})

            # 检查API密钥是否是环境变量格式且未设置
            api_key = openai_config.get("api_key")
            if (
                isinstance(api_key, str)
                and api_key.startswith("${")
                and api_key.endswith("}")
            ):
                env_var_name = api_key[2:-1]
                if not os.getenv(env_var_name):
                    logging.error(f"环境变量 {env_var_name} 未设置，将使用回退LLM")
                    self._create_fallback_llm()
                    return

                api_key = os.getenv(env_var_name)

            base_url = openai_config.get("base_url")
            if not base_url or base_url.strip() == "":
                logging.error("base_url 未设置，将使用回退LLM")
                self._create_fallback_llm()
                return

            model_name = openai_config.get("model_name")
            if not model_name or model_name.strip() == "":
                logging.error("model_name 未设置，将使用回退LLM")
                self._create_fallback_llm()
                return

            # 创建LLM实例 - 添加专门的异常处理
            try:
                self.base_llm = ChatOpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    temperature=openai_config.get("temperature", 0.7),
                    max_tokens=openai_config.get("max_tokens", 1000),
                    model=model_name,
                    timeout=openai_config.get("timeout", 30),
                    max_retries=openai_config.get("max_retries", 3),
                    model_kwargs={"response_format": {"type": "json_object"}},
                )
            except Exception as e:
                logging.error(f"ChatOpenAI 初始化失败: {e}，将使用回退LLM")
                self._create_fallback_llm()
                return

            # 创建工具列表
            self.base_tools = self._create_tools()

            self.initialized = True
            logging.info(f"AI引擎已为用户 {self.user_id} 初始化基础组件")

        except Exception as e:
            logging.error(f"AI引擎初始化失败: {e}")
            # 创建回退LLM
            self._create_fallback_llm()

    def _create_tools(self) -> list:
        """创建工具列表"""
        tools = []

        # 示例工具：计算器
        def test_tool(query: str) -> str:
            return f"测试工具: {query}"

        tools.append(
            Tool(
                name="test_tool",
                func=test_tool,
                description="测试工具"))

        # 如果存在service层，可以添加更多工具
        if HAS_SERVICE_LAYER:
            try:
                # 添加MCP工具
                _ = MCPService()  # 创建MCP服务实例，但当前未使用
                # 这里可以添加MCP工具，具体取决于MCP服务的实现
                pass
            except Exception as e:
                print(f"添加MCP工具失败: {e}")

        return tools

    def _create_fallback_llm(self):
        """创建回退LLM（当主LLM初始化失败时）"""
        # 创建一个简单的回退LLM
        from langchain_community.llms import FakeListLLM

        responses = ["这是一个示例响应。AI引擎初始化失败，请检查配置。"]
        self.base_llm = FakeListLLM(responses=responses)
        self.base_tools = []
        self.initialized = True
        print(f"已为用户 {self.user_id} 创建回退LLM")

    def _get_or_create_session_engine(self, session_id: str) -> AIEngine:
        """获取或创建会话特定的AI引擎"""
        if session_id not in self.session_engines:
            if not self.initialized:
                self.initialize()

            if not self.base_llm:
                raise ValueError("LLM未初始化")

            # 使用EngineBuilder构建AI引擎
            builder = EngineBuilder()
            builder.with_llm(self.base_llm)
            if self.base_tools:
                builder.with_tools(self.base_tools)

            # 添加历史记录
            db = next(
                get_db()
            )
            # 查询消息，按时间顺序排列
            db_messages = db.query(DBMessage)\
                .filter(DBMessage.session_id == session_id, DBMessage.status == "sent")\
                .order_by(DBMessage.timestamp.asc())\
                .all()
            logging.info(f"从数据库获取会话 {session_id} 的消息: {db_messages}")
            if len(db_messages) > 0:
                # 转换为langchain_core.messages格式
                messages = [{"role": msg.role, "content": msg.content}
                            for msg in db_messages]
                logging.info(f"转换后的消息: {messages}")
                builder.with_history(messages)

            # 添加系统提示词文件配置
            system_prompt_file = os.path.join(
                os.path.dirname(__file__), "..", "config", "system_prompt.txt"
            )
            builder.with_system_prompt_file(system_prompt_file)

            engine = builder.build()
            self.session_engines[session_id] = engine

        return self.session_engines[session_id]

    def run(self, user_input: str, session_id: str) -> str:
        """运行AI引擎处理用户输入"""
        try:
            engine = self._get_or_create_session_engine(session_id)
            result = engine.run(user_input)
            return result
        except Exception as e:
            raise Exception(f"AI处理错误: {str(e)}")

    def process_message(self, session_id: str, message: str) -> str:
        """处理消息（run方法的别名）"""
        return self.run(message, session_id)

    def clear_session_engine(self, session_id: str):
        """清除特定会话的引擎"""
        if session_id in self.session_engines:
            del self.session_engines[session_id]

    def clear_all_session_engines(self):
        """清除所有会话的引擎"""
        self.session_engines.clear()


# 全局引擎管理器
_engine_wrappers: Dict[str, AIEngineWrapper] = {}  # user_id -> wrapper


def get_engine_for_user(user_id: str) -> AIEngineWrapper:
    """获取用户的AI引擎包装器"""
    if user_id not in _engine_wrappers:
        _engine_wrappers[user_id] = AIEngineWrapper(user_id)

    wrapper = _engine_wrappers[user_id]
    if not wrapper.initialized:
        wrapper.initialize()

    return wrapper


def clear_user_engine(user_id: str):
    """清除用户的AI引擎"""
    if user_id in _engine_wrappers:
        del _engine_wrappers[user_id]


def clear_all_engines():
    """清除所有AI引擎"""
    _engine_wrappers.clear()
