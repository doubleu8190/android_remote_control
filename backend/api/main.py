from . import auth, sessions, messages, llm_configs
from backend.config.config_loader import logging_config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from contextlib import asynccontextmanager
from datetime import datetime
from backend.infra import database
from backend.infra.scrcpy_service_manager import scrcpy_service_manager
import logging
import sys
from fastapi import WebSocket


# 配置根日志器
root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, logging_config.get_config("logging.level", "INFO")))

# 清除已有的处理器
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# 添加控制台处理器
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(getattr(logging, logging_config.get_config("logging.level", "INFO")))
formatter = logging.Formatter(
    logging_config.get_config("logging.format"),
    datefmt=logging_config.get_config("logging.datefmt")
)
console_handler.setFormatter(formatter)
root_logger.addHandler(console_handler)

# 配置子模块日志器
for module in ['infra', 'api', 'engine']:
    module_logger = logging.getLogger(module)
    module_logger.setLevel(getattr(logging, logging_config.get_config("logging.level", "INFO")))

# 禁用uvicorn的默认日志配置
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn.error").setLevel(logging.INFO)


# 定义生命周期
@asynccontextmanager
async def lifespan(app: FastAPI):
    # -------------------
    # 【启动阶段】应用启动时执行
    # -------------------
    """应用启动时初始化数据库"""
    logging.info("正在初始化数据库...")
    try:
        database.init_db()
        logging.info("✅ 数据库初始化完成")
    except Exception as e:
        logging.error(f"❌ 数据库初始化失败: {e}")
        raise

    # 启动scrcpy服务管理器
    logging.info("正在启动scrcpy服务管理器...")
    try:
        await scrcpy_service_manager.start()
        logging.info("✅ scrcpy服务管理器启动完成")
    except Exception as e:
        logging.error(f"❌ scrcpy服务管理器启动失败: {e}")
        raise

    yield  # 应用保持运行，处理请求

    # -------------------
    # 【关闭阶段】应用关闭时执行
    # -------------------
    logging.info("正在停止scrcpy服务管理器...")
    try:
        await scrcpy_service_manager.stop()
        logging.info("✅ scrcpy服务管理器已停止")
    except Exception as e:
        logging.error(f"❌ scrcpy服务管理器停止失败: {e}")


# 创建FastAPI应用
app = FastAPI(
    title="AI Agent Engine API",
    description="HTTP API for AI Agent Engine with authentication and session management",
    version="1.0.0",
    lifespan=lifespan,
)


# 配置CORS
# 开发环境允许所有来源，生产环境应限制特定域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# 导入路由
app.include_router(auth.router, tags=["authentication"])
app.include_router(sessions.router, tags=["sessions"])
app.include_router(messages.router, tags=["messages"])
app.include_router(llm_configs.router, tags=["llm-configs"])


@app.get("/")
async def root():
    return {
        "message": "AI Agent Engine API",
        "version": "1.0.0",
        "endpoints": {
            "auth": {
                "login": "POST /api/auth/login",
                "register": "POST /api/auth/register",
                "logout": "POST /api/auth/logout",
                "profile": "GET /api/auth/me",
            },
            "sessions": {
                "list": "GET /api/sessions",
                "create": "POST /api/sessions",
                "get": "GET /api/sessions/{session_id}",
                "update": "PUT /api/sessions/{session_id}",
                "delete": "DELETE /api/sessions/{session_id}",
                "rename": "POST /api/sessions/{session_id}/rename",
            },
            "messages": {
                "send": "POST /api/messages/send",
                "send_stream": "POST /api/messages/send/stream",
                "history": "GET /api/messages/history/{session_id}",
                "delete": "DELETE /api/messages/{message_id}?session_id={session_id}",
            },
            "llm-configs": {
                "list": "GET /api/llm-configs",
                "create": "POST /api/llm-configs",
                "get": "GET /api/llm-configs/{config_id}",
                "update": "PUT /api/llm-configs/{config_id}",
                "delete": "DELETE /api/llm-configs/{config_id}",
            },
        },
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# WebSocket 路由
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await scrcpy_service_manager.handle_client(websocket)


if __name__ == "__main__":
    import uvicorn

    # nosec B104: 开发环境允许绑定到所有接口，生产环境应限制
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8080,
        log_level="info",
        access_log=True,
    )
