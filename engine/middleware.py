import logging
from typing import Callable
from langchain.agents.middleware import AgentState, before_model, wrap_tool_call
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.runtime import Runtime
from langgraph.types import Command


@wrap_tool_call
def monitor_tool(
    # 请求参数的封装
    request: ToolCallRequest, 
    # 工具调用处理函数
    handler: Callable[[ToolCallRequest], ToolMessage, Command]
):
    logging.info(f"Tool call: {request.tool_call['name']}")
    logging.info(f"Tool call arguments: {request.tool_call['args']}")

    try:
        response = handler(request)
        logging.info(f"Tool call response: {response}")
        return response
    except Exception as e:
        logging.error(f"Tool call error: {str(e)}")
        raise e

@before_model
def monitor_model(
    # Agent智能体中的状态记录
    state: AgentState, 
    # 记录了整个执行过程中的上下文信息
    runtime: Runtime
):
    logging.info(f"prepare to call model, with {len(state['messages'])} messages")
    logging.debug(f"message detail: {state['messages'][-1]}")
    return None

