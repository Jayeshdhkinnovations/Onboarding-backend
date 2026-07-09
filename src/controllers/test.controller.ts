import { Request, Response } from "express";
import User from "../models/User";
import Workspace from "../models/Workspace";

export const createDummyUser = async (
  req: Request,
  res: Response
) => {
  try {

    // 1. Create User
    const user = await User.create({
      firebaseUid: "firebase_test_123",
      fullName: "Jayesh Chaudhary",
      email: "jayesh@test.com",
      role: "admin",
    });

    // 2. Create Workspace
    const workspace = await Workspace.create({
      name: "OnBoard Workspace",
      description: "Testing Workspace",
      owner: user._id
    });

    // 3. Update User with Workspace ID
    user.workspaceId = workspace._id;
    await user.save();

    res.status(201).json({
      success: true,
      message: "Dummy User & Workspace Created Successfully",
      user,
      workspace,
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};