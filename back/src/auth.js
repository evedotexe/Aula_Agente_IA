const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");
const { createUser, findUserByEmail, findUserById } = require("./database");
const { createHttpError, publicUser } = require("./helpers");

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function registerUser({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanName || !cleanEmail || cleanPassword.length < 6) {
    throw createHttpError(400, "Informe nome, email e uma senha com pelo menos 6 caracteres");
  }

  try {
    const user = await createUser({
      name: cleanName,
      email: cleanEmail,
      passwordHash: await bcrypt.hash(cleanPassword, 10),
    });

    return {
      token: createToken(user),
      user: publicUser(user),
    };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      throw createHttpError(409, "Este email ja esta cadastrado");
    }

    throw err;
  }
}

async function loginUser({ email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  const user = await findUserByEmail(cleanEmail);

  if (!user || !(await bcrypt.compare(cleanPassword, user.password_hash))) {
    throw createHttpError(401, "Email ou senha invalidos");
  }

  return {
    token: createToken(user),
    user: publicUser(user),
  };
}

async function authMiddleware(req, _res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return next(createHttpError(401, "Token nao informado"));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.sub);

    if (!user) {
      return next(createHttpError(401, "Usuario nao encontrado"));
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err.publicMessage ? err : createHttpError(401, "Token invalido"));
  }
}

async function optionalAuthMiddleware(req, _res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await findUserById(payload.sub);
  } catch {
    req.user = null;
  }

  return next();
}

module.exports = {
  authMiddleware,
  loginUser,
  optionalAuthMiddleware,
  registerUser,
};
