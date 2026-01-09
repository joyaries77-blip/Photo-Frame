import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'app-icon.svg');
const outputDir = path.join(__dirname, 'app', 'src', 'main', 'res');

// 图标尺寸映射
const iconSizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

// 启动画面尺寸映射（竖屏）
const splashSizes = {
  'mdpi': { width: 320, height: 480 },
  'hdpi': { width: 480, height: 800 },
  'xhdpi': { width: 720, height: 1280 },
  'xxhdpi': { width: 1080, height: 1920 },
  'xxxhdpi': { width: 1440, height: 2560 }
};

async function generateIcons() {
  console.log('开始生成图标...');

  // 生成应用图标
  for (const [density, size] of Object.entries(iconSizes)) {
    const mipmapDir = path.join(outputDir, `mipmap-${density}`);
    
    if (!fs.existsSync(mipmapDir)) {
      fs.mkdirSync(mipmapDir, { recursive: true });
    }

    console.log(`生成 ${density} 图标 (${size}x${size})...`);

    // 生成 ic_launcher.png
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(mipmapDir, 'ic_launcher.png'));

    // 生成 ic_launcher_round.png（圆形）
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(mipmapDir, 'ic_launcher_round.png'));

    // 生成 ic_launcher_foreground.png（前景，用于自适应图标）
    // 对于所有密度都生成，但 xxxhdpi 使用 1024x1024，其他使用相应尺寸
    if (density === 'xxxhdpi') {
      await sharp(svgPath)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(mipmapDir, 'ic_launcher_foreground.png'));
    } else {
      // 其他密度也生成 foreground，使用与主图标相同的尺寸
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(path.join(mipmapDir, 'ic_launcher_foreground.png'));
    }
  }

  // 生成启动画面
  console.log('\n生成启动画面...');
  
  // 基础启动画面
  const drawableDir = path.join(outputDir, 'drawable');
  if (!fs.existsSync(drawableDir)) {
    fs.mkdirSync(drawableDir, { recursive: true });
  }

  // 创建一个带背景的启动画面（图标居中）
  const splashSvg = `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1920" fill="#E7E5E4"/>
      <g transform="translate(284, 860)">
        <rect width="512" height="512" rx="112" fill="#E7E5E4"/>
        <rect x="106" y="146" width="300" height="220" rx="32" stroke="#292524" stroke-width="24" fill="none"/>
        <circle cx="256" cy="256" r="72" stroke="#292524" stroke-width="24" fill="none"/>
        <circle cx="350" cy="190" r="16" fill="#292524"/>
        <path d="M150 146V126C150 115 159 106 170 106H230" stroke="#292524" stroke-width="24" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  for (const [density, dimensions] of Object.entries(splashSizes)) {
    const splashDir = path.join(outputDir, `drawable-port-${density}`);
    if (!fs.existsSync(splashDir)) {
      fs.mkdirSync(splashDir, { recursive: true });
    }

    console.log(`生成 ${density} 启动画面 (${dimensions.width}x${dimensions.height})...`);

    // 计算图标在启动画面中的位置（居中）
    const iconSize = Math.min(dimensions.width, dimensions.height) * 0.4;
    const iconX = (dimensions.width - iconSize) / 2;
    const iconY = (dimensions.height - iconSize) / 2;

    const splashSvgScaled = `
      <svg width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${dimensions.width}" height="${dimensions.height}" fill="#E7E5E4"/>
        <g transform="translate(${iconX}, ${iconY}) scale(${iconSize / 512})">
          <rect width="512" height="512" rx="112" fill="#E7E5E4"/>
          <rect x="106" y="146" width="300" height="220" rx="32" stroke="#292524" stroke-width="24" fill="none"/>
          <circle cx="256" cy="256" r="72" stroke="#292524" stroke-width="24" fill="none"/>
          <circle cx="350" cy="190" r="16" fill="#292524"/>
          <path d="M150 146V126C150 115 159 106 170 106H230" stroke="#292524" stroke-width="24" stroke-linecap="round"/>
        </g>
      </svg>
    `;

    await sharp(Buffer.from(splashSvgScaled))
      .png()
      .toFile(path.join(splashDir, 'splash.png'));
  }

  // 基础启动画面（drawable/splash.png）
  const baseSplashSvg = `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1920" fill="#E7E5E4"/>
      <g transform="translate(284, 860)">
        <rect width="512" height="512" rx="112" fill="#E7E5E4"/>
        <rect x="106" y="146" width="300" height="220" rx="32" stroke="#292524" stroke-width="24" fill="none"/>
        <circle cx="256" cy="256" r="72" stroke="#292524" stroke-width="24" fill="none"/>
        <circle cx="350" cy="190" r="16" fill="#292524"/>
        <path d="M150 146V126C150 115 159 106 170 106H230" stroke="#292524" stroke-width="24" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(baseSplashSvg))
    .png()
    .toFile(path.join(drawableDir, 'splash.png'));

  console.log('\n图标生成完成！');
  console.log('请运行以下命令重新构建应用：');
  console.log('  cd android');
  console.log('  ./gradlew clean');
  console.log('  ./gradlew assembleDebug');
}

generateIcons().catch(console.error);

