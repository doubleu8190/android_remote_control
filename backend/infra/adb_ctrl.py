import subprocess
import logging
import asyncio
from typing import Optional

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
