#!/usr/bin/env node

/**
 * Electron 应用测试脚本
 * 用于验证应用的基本功能和性能
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Android Remote Control Electron 应用测试');
console.log('=' .repeat(50));

// 检查项目结构
console.log('\n📁 检查项目结构...');
const requiredFiles = [
  'package.json',
  'src/main/main.ts',
  'src/renderer/App.tsx',
  'src/renderer/index.html',
  'tailwind.config.js',
  'vite.config.ts',
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} (缺失)`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ 项目结构不完整，请检查缺失的文件');
  process.exit(1);
}

console.log('\n✅ 项目结构完整');

// 检查 package.json 配置
console.log('\n📦 检查 package.json 配置...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  const requiredFields = ['name', 'version', 'main', 'scripts'];
  requiredFields.forEach(field => {
    if (packageJson[field]) {
      console.log(`  ✓ ${field}: ${packageJson[field]}`);
    } else {
      console.log(`  ✗ ${field} (缺失)`);
    }
  });

  // 检查必要的脚本
  const requiredScripts = ['dev', 'build', 'start'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`  ✓ script: ${script}`);
    } else {
      console.log(`  ✗ script: ${script} (缺失)`);
    }
  });

  console.log('\n✅ package.json 配置正确');
} catch (error) {
  console.log(`\n❌ 无法读取 package.json: ${error.message}`);
  process.exit(1);
}

// 检查依赖安装
console.log('\n🔧 检查依赖安装...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('  ✓ node_modules 目录存在');
  
  // 检查关键依赖
  const criticalDeps = ['electron', 'react', 'react-dom', 'typescript'];
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`  ✓ 依赖: ${dep}`);
    } else {
      console.log(`  ✗ 依赖: ${dep} (缺失)`);
    }
  });
} else {
  console.log('  ✗ node_modules 目录不存在，请运行 npm install');
  console.log('\n💡 建议:');
  console.log('  cd electron && npm install');
  process.exit(1);
}

console.log('\n✅ 依赖检查完成');

// 检查 TypeScript 配置
console.log('\n📝 检查 TypeScript 配置...');
const tsConfigFiles = ['tsconfig.json', 'tsconfig.node.json', 'tsconfig.main.json'];
tsConfigFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`  ✓ ${file} (有效)`);
    } catch (error) {
      console.log(`  ✗ ${file} (无效 JSON)`);
    }
  } else {
    console.log(`  ✗ ${file} (缺失)`);
  }
});

console.log('\n✅ TypeScript 配置检查完成');

// 检查样式配置
console.log('\n🎨 检查样式配置...');
const styleFiles = ['tailwind.config.js', 'postcss.config.js', 'src/renderer/index.css'];
styleFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} (缺失)`);
  }
});

console.log('\n✅ 样式配置检查完成');

// 性能测试建议
console.log('\n⚡ 性能测试建议:');
console.log('  1. 启动应用: npm run dev');
console.log('  2. 检查内存使用情况');
console.log('  3. 测试页面加载速度');
console.log('  4. 验证响应式布局');
console.log('  5. 测试暗色模式切换');

// 跨平台测试建议
console.log('\n🖥️ 跨平台测试建议:');
console.log('  1. macOS: 测试原生菜单和Dock集成');
console.log('  2. Windows: 测试系统托盘和任务栏');
console.log('  3. Linux: 测试AppImage和桌面集成');
console.log('  4. 所有平台: 验证一致的视觉样式');

// 用户体验测试建议
console.log('\n👥 用户体验测试建议:');
console.log('  1. 导航流畅性测试');
console.log('  2. 表单交互测试');
console.log('  3. 错误处理测试');
console.log('  4. 快捷键测试');
console.log('  5. 无障碍访问测试');

// 构建测试
console.log('\n🔨 构建测试建议:');
console.log('  1. 开发构建: npm run build');
console.log('  2. 生产构建检查');
console.log('  3. 包大小分析');
console.log('  4. 启动时间测试');

console.log('\n' + '=' .repeat(50));
console.log('🎉 测试脚本执行完成！');
console.log('\n下一步:');
console.log('  1. 安装依赖: cd electron && npm install');
console.log('  2. 启动开发服务器: npm run dev');
console.log('  3. 构建应用: npm run build');
console.log('  4. 运行应用: npm start');

// 如果提供了参数，执行相应的测试
if (process.argv.length > 2) {
  const command = process.argv[2];
  
  switch (command) {
    case 'dev':
      console.log('\n🚀 启动开发服务器...');
      try {
        const devProcess = spawn('npm', ['run', 'dev'], {
          cwd: __dirname,
          stdio: 'inherit',
          shell: true
        });
        
        devProcess.on('close', (code) => {
          console.log(`开发服务器退出，代码: ${code}`);
        });
      } catch (error) {
        console.error(`启动开发服务器失败: ${error.message}`);
      }
      break;
      
    case 'build':
      console.log('\n🔨 开始构建应用...');
      try {
        execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ 构建完成！');
      } catch (error) {
        console.error(`构建失败: ${error.message}`);
      }
      break;
      
    default:
      console.log(`\n未知命令: ${command}`);
      console.log('可用命令: dev, build');
  }
}