from typing import Dict, Optional, Any
import uuid
from datetime import datetime

from engine.engine import AIEngine, EngineBuilder
from langchain_openai import OpenAI
from langchain_community.tools import Tool

# 导入service层（如果存在）
try:
    from service.llm_service import LLMService
    from service.context_compression import ContextCompressionService
    from service.mcp_service import MCPService
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
        
    def initialize(self):
        """初始化AI引擎（创建基础LLM和工具）"""
        if self.initialized:
            return
        
        try:
            # 创建LLM实例
            # 在实际应用中，这里应该从配置或环境变量中获取API密钥
            self.base_llm = OpenAI(
                temperature=0.7,
                max_tokens=1000,
                model_name="gpt-3.5-turbo"  # 可以根据需要更改模型
            )
            
            # 创建工具列表
            self.base_tools = self._create_tools()
            
            self.initialized = True
            print(f"AI引擎已为用户 {self.user_id} 初始化基础组件")
            
        except Exception as e:
            print(f"AI引擎初始化失败: {e}")
            # 创建回退LLM
            self._create_fallback_llm()
    
    def _create_tools(self) -> list:
        """创建工具列表"""
        tools = []
        
        # 示例工具：计算器
        def calculator(query: str) -> str:
            """执行数学计算。输入应为数学表达式，如 '2+2' 或 'sin(30)'"""
            try:
                # 简单实现 - 在实际应用中应该使用更安全的评估方法
                # 这里只是示例
                if "sin" in query or "cos" in query or "tan" in query:
                    return "三角函数计算需要更复杂的实现"
                elif "+" in query or "-" in query or "*" in query or "/" in query:
                    # 非常简单的评估（仅用于演示）
                    parts = query.replace(" ", "").split("+")
                    if len(parts) > 1:
                        return str(sum(float(p) for p in parts))
                return f"无法计算: {query}"
            except Exception as e:
                return f"计算错误: {e}"
        
        tools.append(
            Tool(
                name="calculator",
                func=calculator,
                description="执行数学计算。输入应为数学表达式，如 '2+2' 或 'sin(30)'"
            )
        )
        
        # 如果存在service层，可以添加更多工具
        if HAS_SERVICE_LAYER:
            try:
                # 添加MCP工具
                mcp_service = MCPService()
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
            return f"AI处理错误: {str(e)}"
    
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