import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSkills() {
  try {
    const skills = await prisma.skill.findMany({
      select: { name: true, category: true, enabled: true },
      orderBy: { name: 'asc' }
    });
    console.log('技巧总数:', skills.length);
    console.log('\n技巧列表:');
    skills.forEach((s, i) => {
      console.log(`${i+1}. ${s.name} (${s.category}) - ${s.enabled ? '启用' : '停用'}`);
    });
  } catch (e) {
    console.error('错误:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkSkills();
