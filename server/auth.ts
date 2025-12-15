import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "instarel-research-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

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
      const { password, ...researcherWithoutPassword } = researcher;
      res.status(201).json(researcherWithoutPassword);
    });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const { password, ...researcherWithoutPassword } = req.user!;
    res.status(200).json(researcherWithoutPassword);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...researcherWithoutPassword } = req.user!;
    res.json(researcherWithoutPassword);
  });
}
