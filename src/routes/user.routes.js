import {Router} from "express";
import { 
    registerUser, 
    loginUser, 
    refreshAccessToken, 
    logoutUser, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCover, 
    getChannelProfile, 
    getWatchHistory 
} from "../controllers/user.controllers.js";

import {upload} from "../middlewares/multer.middlewares.js";
import {verifyJWT} from "../middlewares/auth.middlewares.js";

const router = Router();

// unsecured routes - which will not have verify JWT as a middleware
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);


router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);


// secure routes - which will have verify JWT
router.route("/watch-history").get(verifyJWT, getWatchHistory);
router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/change-password").patch(verifyJWT, changeCurrentPassword);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/update-cover").patch(verifyJWT, upload.single("coverImage"), updateUserCover);



// since it needs to extract username from the url (req.params) same variable must be used to extract it
router.route("/c/:username").get(verifyJWT, getChannelProfile);


console.log("Register user routes: ok");

export default router;

