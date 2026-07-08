import jwt from "jsonwebtoken";
export const generateToken = (
  payload: {
    id: string;
    email: string;
    role: string;
  }
)=> {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );
};