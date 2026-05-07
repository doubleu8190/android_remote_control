"""
Phone control tools for the AI engine.
Wraps ADB functions as LangChain StructuredTools, bound to a specific device.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool, StructuredTool
from backend.infra import adb_ctrl
import json
import logging

logger = logging.getLogger(__name__)


# ============ Pydantic Argument Schemas ============

class TapInput(BaseModel):
    x: int = Field(..., description="X coordinate to tap on the screen")
    y: int = Field(..., description="Y coordinate to tap on the screen")


class SwipeInput(BaseModel):
    x1: int = Field(..., description="Starting X coordinate")
    y1: int = Field(..., description="Starting Y coordinate")
    x2: int = Field(..., description="Ending X coordinate")
    y2: int = Field(..., description="Ending Y coordinate")
    duration: int = Field(300, description="Duration of swipe in milliseconds")


class InputTextInput(BaseModel):
    text: str = Field(..., description="Text to input into the currently focused field")


class GetUIHierarchyInput(BaseModel):
    pass


class GetScreenResolutionInput(BaseModel):
    pass


# ============ Tool Factory Functions ============

def _make_tap_tool(device_ip: str, device_port: int) -> StructuredTool:
    def _run(x: int, y: int) -> str:
        logger.info(f"Tool tap({x}, {y}) on {device_ip}:{device_port}")
        adb_ctrl.tap(device_ip, device_port, x, y)
        return json.dumps({"action": "tap", "x": x, "y": y, "status": "success"})

    return StructuredTool.from_function(
        name="tap",
        description="Tap at the specified (x, y) coordinates on the phone screen. "
                     "Call get_ui_hierarchy first to find the target element's center coordinates.",
        args_schema=TapInput,
        func=_run,
    )


def _make_swipe_tool(device_ip: str, device_port: int) -> StructuredTool:
    def _run(x1: int, y1: int, x2: int, y2: int, duration: int = 300) -> str:
        logger.info(f"Tool swipe({x1},{y1} -> {x2},{y2}) on {device_ip}:{device_port}")
        adb_ctrl.swipe(device_ip, device_port, x1, y1, x2, y2, duration)
        return json.dumps({
            "action": "swipe",
            "from": [x1, y1],
            "to": [x2, y2],
            "status": "success",
        })

    return StructuredTool.from_function(
        name="swipe",
        description="Perform a swipe/drag gesture from (x1, y1) to (x2, y2) "
                     "with optional duration in milliseconds.",
        args_schema=SwipeInput,
        func=_run,
    )


def _make_input_text_tool(device_ip: str, device_port: int) -> StructuredTool:
    def _run(text: str) -> str:
        logger.info(f"Tool input_text('{text}') on {device_ip}:{device_port}")
        adb_ctrl.input_text(device_ip, device_port, text)
        return json.dumps({"action": "input_text", "text": text, "status": "success"})

    return StructuredTool.from_function(
        name="input_text",
        description="Input text into the currently focused text field on the phone. "
                     "Note: tap on the text field first to focus it before calling this.",
        args_schema=InputTextInput,
        func=_run,
    )


def _make_get_ui_hierarchy_tool(device_ip: str, device_port: int) -> StructuredTool:
    def _run() -> str:
        logger.info(f"Tool get_ui_hierarchy() on {device_ip}:{device_port}")
        result = adb_ctrl.get_ui_hierarchy(device_ip, device_port)
        if result is None:
            return json.dumps({"error": "Unable to retrieve UI hierarchy from device"})
        return json.dumps(result, ensure_ascii=False)

    return StructuredTool.from_function(
        name="get_ui_hierarchy",
        description="Analyze the current screen layout of the phone. "
                     "Returns a JSON with screen resolution and all interactive UI elements "
                     "including their center coordinates, bounds, text labels, content descriptions, "
                     "and element types. Call this first before performing any tap/swipe operation.",
        args_schema=GetUIHierarchyInput,
        func=_run,
    )


def _make_get_screen_resolution_tool(device_ip: str, device_port: int) -> StructuredTool:
    def _run() -> str:
        logger.info(f"Tool get_screen_resolution() on {device_ip}:{device_port}")
        res = adb_ctrl.get_device_resolution(device_ip, device_port)
        if res:
            return json.dumps({"width": res[0], "height": res[1]})
        return json.dumps({"error": "Unable to get screen resolution"})

    return StructuredTool.from_function(
        name="get_screen_resolution",
        description="Get the phone's screen resolution (width and height in pixels). "
                     "Useful for calculating relative coordinates or understanding screen dimensions.",
        args_schema=GetScreenResolutionInput,
        func=_run,
    )


# ============ Factory ============

def create_phone_tools(device_ip: str, device_port: int) -> List[BaseTool]:
    """
    Create all phone control tools bound to a specific device.

    Args:
        device_ip: Android device IP address.
        device_port: Android device ADB port (typically 5555).

    Returns:
        List of LangChain StructuredTool instances.
    """
    if not device_ip or not device_port:
        logger.warning("Device IP or port not provided, skipping phone tool creation")
        return []

    logger.info(f"Creating phone control tools for {device_ip}:{device_port}")
    return [
        _make_get_ui_hierarchy_tool(device_ip, device_port),
        _make_tap_tool(device_ip, device_port),
        _make_swipe_tool(device_ip, device_port),
        _make_input_text_tool(device_ip, device_port),
        _make_get_screen_resolution_tool(device_ip, device_port),
    ]
