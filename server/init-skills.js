const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initSkills() {
  try {
    const count = await prisma.skill.count();
    console.log('当前技巧数量:', count);
    
    if (count === 0) {
      const { ensureSeed } = require('./dist/seedData.js');
      await ensureSeed();
      console.log('技巧数据已初始化');
    } else {
      console.log('技巧数据已存在，跳过初始化');
    }
  } catch (e) {
    console.error('初始化失败:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initSkills();
