const errorMiddleware = (err, req, res, next) => {
    console.error(`[Error Handler] ${err.stack || err.message}`);

    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({
        success: false,
        status,
        message,
        // Only include stack trace in development mode if ever needed,
        // but for now keeping it simple as per user preference
        error: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};

export default errorMiddleware;
