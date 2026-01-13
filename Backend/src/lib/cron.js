import cron from "cron";
import https from "https";
import http from "http";

const job = new cron.CronJob("*/14 * * * *", function () {
    const url = process.env.API_URL;
    if (!url) {
        // console.log("Cron: No API_URL defined, skipping keep-alive ping.");
        return;
    }

    const client = url.startsWith("https") ? https : http;

    client
        .get(url, (res) => {
            if (res.statusCode === 200) console.log("Cron: Keep-alive ping successful");
            else console.log("Cron: Keep-alive ping failed", res.statusCode);
        })
        .on("error", (e) => {
            // Silently log in dev to avoid noise, or log specifically
            if (process.env.NODE_ENV !== "production") {
                console.log("Cron: Ping failed (expected in dev if URL is incorrect or HTTPS is used on local)");
            } else {
                console.error("Cron: Error while sending request", e.message);
            }
        });
});

export default job;

// CRON JOB EXPLANATION:
// Cron jobs are scheduled tasks that run periodically at fixed intervals
// we want to send 1 GET request for every 14 minutes

// How to define a "Schedule"?
// You define a schedule using a cron expression, which consists of 5 fields representing:

//! MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

//? EXAMPLES && EXPLANATION:
//* 14 * * * * - Every 14 minutes
//* 0 0 * * 0 - At midnight on every Sunday
//* 30 3 15 * * - At 3:30 AM, on the 15th of every month
//* 0 0 1 1 * - At midnight, on January 1st
//* 0 * * * * - Every hour