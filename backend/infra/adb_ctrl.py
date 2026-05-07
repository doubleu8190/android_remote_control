import subprocess
import logging
import asyncio
import xml.etree.ElementTree as ET
import re
from typing import Optional, Any

logger = logging.getLogger(__name__)


def run_cmd(cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def adb_connect(device_ip: str, device_port: int) -> bool:
    cmd = f"adb connect {device_ip}:{device_port}"
    result = run_cmd(cmd)
    return result.returncode == 0 and "connected" in result.stdout.lower()


def ensure_connected(device_ip: str, device_port: int) -> bool:
    devices_result = run_cmd("adb devices")
    target = f"{device_ip}:{device_port}"
    for line in devices_result.stdout.strip().split("\n"):
        if target in line and "device" in line:
            return True
    return adb_connect(device_ip, device_port)


def screencap(device_ip: str, device_port: int) -> Optional[bytes]:
    if not ensure_connected(device_ip, device_port):
        logger.error(f"无法连接设备 {device_ip}:{device_port}")
        return None
    cmd = f"adb -s {device_ip}:{device_port} exec-out screencap -p"
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, timeout=5)
        if result.returncode == 0 and len(result.stdout) > 100:
            return result.stdout
        logger.error(f"screencap 失败: {result.stderr.decode(errors='ignore') if result.stderr else 'unknown'}")
        return None
    except subprocess.TimeoutExpired:
        logger.error(f"screencap 超时")
        return None
    except Exception as e:
        logger.error(f"screencap 异常: {e}")
        return None


async def screencap_async(device_ip: str, device_port: int) -> Optional[bytes]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, screencap, device_ip, device_port)


def tap(device_ip: str, device_port: int, x: int, y: int):
    ensure_connected(device_ip, device_port)
    cmd = f"adb -s {device_ip}:{device_port} shell input tap {x} {y}"
    subprocess.run(cmd, shell=True)


def swipe(device_ip: str, device_port: int, x1: int, y1: int, x2: int, y2: int, duration: int = 300):
    ensure_connected(device_ip, device_port)
    cmd = f"adb -s {device_ip}:{device_port} shell input swipe {x1} {y1} {x2} {y2} {duration}"
    subprocess.run(cmd, shell=True)


def input_text(device_ip: str, device_port: int, text: str):
    ensure_connected(device_ip, device_port)
    safe_text = text.replace(" ", "%s")
    cmd = f'adb -s {device_ip}:{device_port} shell input text "{safe_text}"'
    subprocess.run(cmd, shell=True)


def get_device_resolution(device_ip: str, device_port: int) -> Optional[tuple[int, int]]:
    if not ensure_connected(device_ip, device_port):
        return None
    cmd = f"adb -s {device_ip}:{device_port} shell wm size"
    result = run_cmd(cmd)
    if result.returncode == 0:
        try:
            line = result.stdout.strip().split("\n")[-1]
            size_str = line.split(":")[-1].strip()
            w, h = size_str.split("x")
            return int(w), int(h)
        except (ValueError, IndexError):
            logger.error(f"解析分辨率失败: {result.stdout}")
    return None


def get_ui_hierarchy(device_ip: str, device_port: int) -> Optional[dict[str, Any]]:
    """
    Get the current UI hierarchy from the device using uiautomator dump.
    Returns parsed elements with bounds, center coordinates, text, and content-desc.
    """
    if not ensure_connected(device_ip, device_port):
        logger.error(f"无法连接设备 {device_ip}:{device_port}")
        return None

    # Dump UI hierarchy to device's local storage
    dump_cmd = f"adb -s {device_ip}:{device_port} shell uiautomator dump"
    subprocess.run(dump_cmd, shell=True, capture_output=True, timeout=10)

    # Read the dump file (commonly found at /sdcard/window_dump.xml, fallback to /data/local/tmp)
    for path in ["/sdcard/window_dump.xml", "/data/local/tmp/window_dump.xml"]:
        read_cmd = f"adb -s {device_ip}:{device_port} shell cat {path}"
        result = subprocess.run(read_cmd, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and len(result.stdout.strip()) > 50:
            break
    else:
        logger.error("UI hierarchy dump file not found on device")
        return None

    try:
        root = ET.fromstring(result.stdout.encode("utf-8"))
        elements: list[dict[str, Any]] = []

        def extract_nodes(node: ET.Element, depth: int = 0) -> None:
            bounds = node.get("bounds", "")
            match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
            if match:
                x1, y1, x2, y2 = map(int, match.groups())
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
            else:
                center_x = center_y = 0

            clickable = node.get("clickable") == "true"
            text = (node.get("text") or "").strip()
            content_desc = (node.get("content-desc") or "").strip()
            cls = node.get("class", "").split(".")[-1] if node.get("class") else ""

            # Include elements that are clickable, have text, or have content descriptions
            if (clickable or text or content_desc) and center_x > 0 and center_y > 0:
                elements.append({
                    "text": text,
                    "content_desc": content_desc,
                    "class": cls,
                    "clickable": clickable,
                    "center": [center_x, center_y],
                    "bounds": [x1, y1, x2, y2],
                })

            for child in node:
                extract_nodes(child, depth + 1)

        extract_nodes(root)

        # Also include screen resolution
        resolution = get_device_resolution(device_ip, device_port)

        return {
            "screen_resolution": {"width": resolution[0], "height": resolution[1]} if resolution else None,
            "elements_count": len(elements),
            "elements": elements,
        }
    except ET.ParseError as e:
        logger.error(f"解析UI层次结构XML失败: {e}")
        return None
    except Exception as e:
        logger.error(f"处理UI层次结构异常: {e}")
        return None


async def get_ui_hierarchy_async(device_ip: str, device_port: int) -> Optional[dict[str, Any]]:
    """Async wrapper for get_ui_hierarchy."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_ui_hierarchy, device_ip, device_port)
