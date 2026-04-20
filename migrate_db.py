#!/usr/bin/env python3
"""
数据库迁移脚本 - 添加device_ip和device_port字段到sessions表
"""
import sqlite3
import os

def migrate_database():
    db_path = os.path.join(os.path.dirname(__file__), "data/ai_agent.db")

    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return

    print(f"连接数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查sessions表是否有device_ip和device_port字段
    cursor.execute("PRAGMA table_info(sessions)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"当前sessions表字段: {columns}")

    # 添加device_ip字段
    if 'device_ip' not in columns:
        print("添加device_ip字段...")
        cursor.execute("ALTER TABLE sessions ADD COLUMN device_ip VARCHAR")
        print("✓ device_ip字段已添加")
    else:
        print("✓ device_ip字段已存在")

    # 添加device_port字段
    if 'device_port' not in columns:
        print("添加device_port字段...")
        cursor.execute("ALTER TABLE sessions ADD COLUMN device_port VARCHAR")
        print("✓ device_port字段已添加")
    else:
        print("✓ device_port字段已存在")

    conn.commit()

    # 验证更改
    cursor.execute("PRAGMA table_info(sessions)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"更新后sessions表字段: {columns}")

    conn.close()
    print("数据库迁移完成!")

if __name__ == "__main__":
    migrate_database()
