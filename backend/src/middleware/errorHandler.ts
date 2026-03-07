import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: err.message,
    });
  }

  // Custom application errors
  if (err.message.includes('not found')) {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: err.message,
    });
  }

  if (err.message.includes('not configured') || err.message.includes('not authenticated')) {
    return res.status(401).json({
      success: false,
      error: 'Configuration error',
      message: err.message,
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
};
