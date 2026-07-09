import { Request, Response, NextFunction } from "express";
import Workspace from "../models/Workspace";
import User from "../models/User";

export const createWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { name, description, logo } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: "Workspace name is required" });
      return;
    }

    const workspace = await Workspace.create({
      name,
      description,
      logo,
      owner: authReq.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    if (workspace.owner.toString() !== authReq.user._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: You are not the owner of this workspace" });
      return;
    }

    res.status(200).json({
      success: true,
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const updateWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const { name, description, logo } = req.body;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    if (workspace.owner.toString() !== authReq.user._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: You are not the owner of this workspace" });
      return;
    }

    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (logo !== undefined) workspace.logo = logo;

    await workspace.save();

    res.status(200).json({
      success: true,
      message: "Workspace updated successfully",
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    if (workspace.owner.toString() !== authReq.user._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: You are not the owner of this workspace" });
      return;
    }

    await Workspace.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
