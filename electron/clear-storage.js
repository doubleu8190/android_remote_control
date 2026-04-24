#!/usr/bin/env node

/**
 * 清除 Electron 应用的 localStorage 数据
 * 用于解决登录状态残留问题
 */

const fs = require('fs');
const path = require('path');

// 不同平台的 localStorage 存储路径
const getStoragePath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  
  switch (process.platform) {
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'android-remote-control-electron', 'Local Storage');
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'android-remote-control-electron', 'Local Storage');
    case 'linux':
      return path.join(homeDir, '.config', 'android-remote-control-electron', 'Local Storage');
    default:
      console.error('Unsupported platform:', process.platform);
      process.exit(1);
  }
};

const storagePath = getStoragePath();

console.log('🔍 查找 localStorage 存储路径:', storagePath);

if (fs.existsSync(storagePath)) {
  console.log('✅ 找到 localStorage 存储目录');
  
  // 列出目录内容
  const files = fs.readdirSync(storagePath);
  console.log('📁 目录内容:', files);
  
  // 删除 leveldb 目录（localStorage 的存储位置）
  const leveldbPath = path.join(storagePath, 'leveldb');
  if (fs.existsSync(leveldbPath)) {
    console.log('🗑️  删除 leveldb 目录...');
    try {
      // 递归删除目录
      const deleteDir = (dirPath) => {
        if (fs.existsSync(dirPath)) {
          fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteDir(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      };
      
      deleteDir(leveldbPath);
      console.log('✅ 已清除 localStorage 数据');
      console.log('\n🚀 现在重新启动应用，应该会显示登录页面了');
    } catch (error) {
      console.error('❌ 删除失败:', error.message);
    }
  } else {
    console.log('ℹ️  未找到 leveldb 目录，可能已经被清除');
  }
} else {
  console.log('ℹ️  未找到 localStorage 存储目录，可能是首次运行');
  console.log('\n🚀 启动应用应该会显示登录页面');
}

console.log('\n💡 提示：');
console.log('  - 应用首次启动时会显示登录页面');
console.log('  - 登录后会在 localStorage 中保存认证状态');
console.log('  - 如需再次看到登录页面，请运行此脚本清除存储');
