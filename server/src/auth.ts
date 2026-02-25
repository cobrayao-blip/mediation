/**
 * JWT 鉴权：登录签发 Token，中间件校验
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mediation-dev-secret-change-in-prod";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

export interface JwtPayload {
  userId: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** 从 Authorization: Bearer <token> 或 cookie 读取并校验，写入 req.user */
export function authMiddleware(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req as Request & { cookies?: { token?: string } }).cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "未登录或 Token 已失效" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token 无效或已过期" });
  }
  req.user = payload;
  next();
}

/** 可选鉴权：有 Token 则校验并写入 req.user，无 Token 不拦截，用于评估等可匿名调用的接口 */
export function optionalAuthMiddleware(req: Request & { user?: JwtPayload }, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req as Request & { cookies?: { token?: string } }).cookies?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

/** 仅管理员可访问 */
export function adminOnly(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "需要管理员权限" });
  }
  next();
}

/** 登录：邮箱/手机 + 密码，返回 JWT */
export async function login(emailOrPhone: string, password: string): Promise<{ token: string; user: { id: string; name: string; role: string } } | null> {
  const user = await prisma.user.findFirst({
    where: {
      status: "active",
      OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  const token = signToken({ userId: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, name: user.name, role: user.role },
  };
}
