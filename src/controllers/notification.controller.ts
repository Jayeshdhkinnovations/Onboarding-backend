import { Request, Response, NextFunction } from "express";
import Notification from "../models/Notification";

/**
 * GET /api/notifications
 * Lists caller's notifications (newest first, max 50).
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const notifications = await Notification.find({ userId: authReq.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
    }));

    res.status(200).json({
      success: true,
      notifications: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/:id/read or PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
export const markNotificationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    if (notification.userId.toString() !== authReq.user._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: Access denied to notification" });
      return;
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification: {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
