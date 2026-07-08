import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "http";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import app from "./src/app";
import User from "./src/models/User";
import Workspace from "./src/models/Workspace";
import Form from "./src/models/Form";

async function run() {
  console.log("🚀 Starting Mongo Memory Server...");
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  console.log("🔗 Connecting mongoose...");
  await mongoose.connect(mongoUri);
  
  // Clean DB
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  
  console.log("🌱 Seeding test data...");
  // Create User A
  const userA = await User.create({
    firebaseUid: "user-a-bruno",
    fullName: "User A",
    email: "usera.bruno@test.com",
    role: "admin"
  });
  
  // Create Workspace A
  const wsA = await Workspace.create({
    name: "Workspace A",
    owner: userA._id
  });
  
  userA.workspaceId = wsA._id;
  await userA.save();
  
  // Create User B (for 403 Forbidden checks)
  const userB = await User.create({
    firebaseUid: "user-b-bruno",
    fullName: "User B",
    email: "userb.bruno@test.com",
    role: "admin"
  });
  
  // Create Workspace B
  const wsB = await Workspace.create({
    name: "Workspace B",
    owner: userB._id
  });
  
  userB.workspaceId = wsB._id;
  await userB.save();
  
  // Create a Form under Workspace A
  const formA = await Form.create({
    title: "Initial Form",
    description: "Form for Bruno test",
    workspaceId: wsA._id,
    status: "active",
    fields: [
      {
        label: "First Field",
        type: "text",
        required: true
      }
    ]
  });
  
  console.log("🔑 Generating JWT tokens...");
  const jwtSecret = "test-secret-key-pbt-1234567890-test-key-long-enough";
  process.env.JWT_SECRET = jwtSecret;
  
  const tokenA = jwt.sign(
    { id: userA._id.toString(), email: userA.email, role: userA.role },
    jwtSecret
  );
  
  const tokenB = jwt.sign(
    { id: userB._id.toString(), email: userB.email, role: userB.role },
    jwtSecret
  );
  
  console.log("⚙️ Configuring Development environment...");
  const envFilePath = path.join(__dirname, "bruno", "environments", "Development.bru");
  const originalEnvContent = fs.readFileSync(envFilePath, "utf8");
  
  // Overwrite environment variables dynamically
  const dynamicEnvContent = `vars {
  base_url: http://localhost:5000
  token: ${tokenA}
  userBToken: ${tokenB}
  formId: ${formA._id.toString()}
  fieldId: ${formA.fields[0].fieldId!}
}
`;
  fs.writeFileSync(envFilePath, dynamicEnvContent, "utf8");

  console.log("⚡ Starting server on port 5000...");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5000, resolve));
  
  try {
    console.log("🏃 Executing Bruno CLI runner asynchronously...");
    await new Promise<void>((resolve, reject) => {
      const child = require("child_process").spawn("node", ["../node_modules/@usebruno/cli/bin/bru.js", "run", "--env", "Development"], {
        cwd: path.join(__dirname, "bruno"),
        stdio: "inherit"
      });
      child.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Exit code ${code}`));
        }
      });
    });
    console.log("✅ Bruno collection executed successfully!");
  } catch (error) {
    console.error("❌ Bruno collection execution failed!", error);
    process.exitCode = 1;
  } finally {
    console.log("♻️ Restoring environment file...");
    fs.writeFileSync(envFilePath, originalEnvContent, "utf8");
    
    console.log("🔌 Shutting down...");
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
