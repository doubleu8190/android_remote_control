#!/usr/bin/env python3
"""
演示新的端口分配机制

此脚本展示优化后的端口分配系统如何解决多会话并发时的端口冲突问题。
"""

import sys
import os
import threading
import time

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from infra.port_allocator import port_allocator

def simulate_concurrent_sessions():
    """模拟多个并发会话同时分配端口"""
    print("=== 模拟多会话并发端口分配 ===")
    
    # 模拟5个并发会话
    sessions = []
    results = []
    
    def allocate_for_session(session_name):
        """为会话分配端口"""
        try:
            port = port_allocator.allocate_port(session_id=session_name)
            if port:
                results.append((session_name, port, "成功"))
                print(f"  {session_name}: 分配到端口 {port}")
            else:
                results.append((session_name, None, "失败"))
                print(f"  {session_name}: 端口分配失败")
        except Exception as e:
            results.append((session_name, None, f"错误: {e}"))
            print(f"  {session_name}: 发生错误 - {e}")
    
    # 创建并启动线程模拟并发
    threads = []
    for i in range(5):
        session_name = f"session_{i+1}"
        thread = threading.Thread(target=allocate_for_session, args=(session_name,))
        threads.append(thread)
        sessions.append(session_name)
    
    # 同时启动所有线程
    print("同时启动5个会话进行端口分配...")
    for thread in threads:
        thread.start()
    
    # 等待所有线程完成
    for thread in threads:
        thread.join()
    
    # 显示分配结果
    print("\n端口分配结果:")
    for session_name, port, status in results:
        if port:
            print(f"  {session_name}: 端口 {port} - {status}")
            # 检查端口是否已正确记录
            if port_allocator.is_port_allocated(port):
                print(f"    ✓ 端口状态已正确记录")
            else:
                print(f"    ✗ 端口状态记录异常")
    
    # 显示所有已分配端口
    print("\n当前所有已分配端口:")
    allocated_ports = port_allocator.get_allocated_ports()
    if allocated_ports:
        for port, info in allocated_ports.items():
            print(f"  端口 {port}: 会话={info.get('session_id')}, PID={info.get('pid')}, 时间={time.ctime(info.get('timestamp'))}")
    else:
        print("  无已分配端口")
    
    # 清理：释放所有端口
    print("\n清理测试端口...")
    for session_name in sessions:
        port_allocator.release_all_ports_by_session(session_name)
    
    print("✓ 所有测试端口已释放")

def demonstrate_port_reuse_prevention():
    """演示端口重用防止机制"""
    print("\n=== 演示端口重用防止机制 ===")
    
    # 第一次分配
    session = "demo_session"
    port1 = port_allocator.allocate_port(session_id=session)
    print(f"1. 首次分配端口: {port1}")
    
    # 尝试再次分配（应该分配到不同的端口）
    port2 = port_allocator.allocate_port(session_id="another_session")
    print(f"2. 再次分配端口: {port2}")
    
    # 验证端口不同
    if port1 != port2:
        print(f"✓ 成功分配到不同的端口: {port1} != {port2}")
    else:
        print(f"✗ 端口分配重复: {port1} == {port2}")
    
    # 清理
    if port1:
        port_allocator.release_port(port1)
    if port2:
        port_allocator.release_port(port2)
    print("✓ 演示端口已释放")

def demonstrate_error_recovery():
    """演示错误恢复机制"""
    print("\n=== 演示错误恢复机制 ===")
    
    # 分配一个端口
    port = port_allocator.allocate_port(session_id="recovery_test")
    if port:
        print(f"1. 分配端口: {port}")
        
        # 模拟端口冲突（手动标记端口为已分配）
        print(f"2. 模拟端口冲突场景...")
        
        # 尝试再次分配同一端口（应该失败并选择其他端口）
        new_port = port_allocator.allocate_port(
            session_id="conflict_test",
            preferred_port=port  # 指定已分配的端口，测试冲突处理
        )
        
        if new_port and new_port != port:
            print(f"3. 冲突处理成功: 分配到新端口 {new_port}")
            print(f"   ✓ 端口冲突已正确处理")
        else:
            print(f"3. 冲突处理: {new_port}")
        
        # 清理
        port_allocator.release_port(port)
        if new_port and new_port != port:
            port_allocator.release_port(new_port)
        print("✓ 测试端口已释放")
    else:
        print("✗ 无法分配测试端口")

def check_system_health():
    """检查系统健康状况"""
    print("\n=== 系统健康检查 ===")
    
    # 检查状态目录
    state_dir = port_allocator.state_dir
    if state_dir.exists():
        print(f"1. 状态目录: {state_dir} (存在)")
        
        state_file = port_allocator.state_file
        if state_file.exists():
            import json
            try:
                with open(state_file, 'r') as f:
                    state_data = json.load(f)
                print(f"2. 状态文件: {state_file} (有效, {len(state_data)} 条记录)")
            except Exception as e:
                print(f"2. 状态文件: {state_file} (错误: {e})")
        else:
            print(f"2. 状态文件: {state_file} (不存在)")
    else:
        print(f"1. 状态目录: {state_dir} (不存在)")
    
    # 检查可用端口数量
    available_count = port_allocator.get_available_port_count()
    print(f"3. 可用端口数量: {available_count}/{port_allocator.port_range}")
    
    # 清理过时端口
    print("4. 执行过时端口清理...")
    port_allocator.cleanup_stale_ports(max_age_seconds=60)  # 清理1分钟前的记录
    print("   ✓ 清理完成")

def main():
    """主函数"""
    print("=" * 60)
    print("SCRCPY 端口分配机制优化演示")
    print("=" * 60)
    
    # 初始化端口分配器
    print("\n初始化端口分配器...")
    print(f"基础端口: {port_allocator.base_port}")
    print(f"端口范围: {port_allocator.port_range}")
    print(f"最大重试次数: {port_allocator.max_retries}")
    
    try:
        # 运行演示
        simulate_concurrent_sessions()
        demonstrate_port_reuse_prevention()
        demonstrate_error_recovery()
        check_system_health()
        
        print("\n" + "=" * 60)
        print("演示完成!")
        print("=" * 60)
        print("\n优化总结:")
        print("1. ✓ 实现了跨进程的端口分配跟踪机制")
        print("2. ✓ 支持多会话并发端口分配")
        print("3. ✓ 防止端口重复分配")
        print("4. ✓ 自动处理端口冲突")
        print("5. ✓ 完善的端口释放和清理机制")
        print("6. ✓ 错误恢复和重试机制")
        
    except Exception as e:
        print(f"\n演示过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())