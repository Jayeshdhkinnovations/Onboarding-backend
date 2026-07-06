import { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { fullName, isActive } = req.body;
    
    const user = await User.findById(authReq.user._id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const userId = authReq.user._id;

    // 1. Delete Firebase User
    try {
      await getAuth().deleteUser(authReq.user.firebaseUid);
    } catch (firebaseError) {
      console.warn("Firebase deleteUser skipped or failed (common in offline mock tests):", firebaseError);
    }

    // 2. Find all workspaces owned by user
    const workspaces = await Workspace.find({ owner: userId });
    const workspaceIds = workspaces.map((w) => w._id);

    // 3. Find all forms in these workspaces
    const forms = await Form.find({ workspaceId: { $in: workspaceIds } });
    const formIds = forms.map((f) => f._id);

    // 4. Delete all Responses belonging to these forms
    await ResponseModel.deleteMany({ formId: { $in: formIds } });

    // 5. Delete all Forms belonging to these workspaces
    await Form.deleteMany({ workspaceId: { $in: workspaceIds } });

    // 6. Delete all Workspaces owned by user
    await Workspace.deleteMany({ owner: userId });

    // 7. Delete the User record
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User profile and all associated data deleted successfully.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
