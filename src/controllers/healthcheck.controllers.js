import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async(req, res) => {
    console.log("health check controller: ok");
    
    return res
        .status(200)
        .json(new ApiResponse(200, "OK", "Health check passed!"));
})

export {healthcheck};