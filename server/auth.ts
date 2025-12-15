import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { Researcher } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends Researcher {}
  }
}

const tokenToUserMap = new Map<string, string>();

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "instarel-research-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: "auto" as any,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const userId = tokenToUserMap.get(token);
        if (userId) {
          const user = await storage.getResearcher(userId);
          if (user) {
            req.user = user;
          }
        }
      }
    }
    next();
  });

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      const researcher = await storage.getResearcherByEmail(email);
      if (!researcher || !(await comparePasswords(password, researcher.password))) {
        return done(null, false);
      } else {
        return done(null, researcher);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getResearcher(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getResearcherByEmail(req.body.email);
    if (existingUser) {
      return res.status(400).send("Email already exists");
    }

    const researcher = await storage.createResearcher({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(researcher, (err) => {
      if (err) return next(err);
      const token = randomBytes(32).toString("hex");
      tokenToUserMap.set(token, researcher.id);
      const { password, ...researcherWithoutPassword } = researcher;
      res.status(201).json({ ...researcherWithoutPassword, token });
    });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const token = randomBytes(32).toString("hex");
    tokenToUserMap.set(token, req.user!.id);
    const { password, ...researcherWithoutPassword } = req.user!;
    res.status(200).json({ ...researcherWithoutPassword, token });
  });

  app.post("/api/logout", (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenToUserMap.delete(token);
    }
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() && !req.user) return res.sendStatus(401);
    const { password, ...researcherWithoutPassword } = req.user!;
    res.json(researcherWithoutPassword);
  });
}
