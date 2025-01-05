import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
    
        if(!user) throw new ApiError(400, "User ID not found");
    
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        
        return {accessToken, refreshToken};
    
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token");  
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const {fullname, username, email, password} = req.body;
    
    // validation
    if([fullname, username, email, password].some((fields) => fields?.trim() === "")){
        throw new ApiError(400, "All fields are requierd");
    }

    // check whether the email or username is already created by anyone in the database 
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    // if exists throw an error
    if(existedUser){
        throw new ApiError(409, "User with username or email already exists");
    }

    // check whether avatar or coverImage is uploaded
    
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverLocalPath = req.files?.coverImage?.[0]?.path;
    if(!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");

    console.log(req.files);
    
    // const avatar = await uploadOnCloudinary(avatarLocalPath); // upload to cloudinary

    // let coverImage = "";
    // if(coverLocalPath){
    //     coverImage = await uploadOnCloudinary(coverLocalPath);
    // }

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Avatar uploaded successfully", avatar);
        
    } catch (error) {
        console.log("Error uploading avatar", error);
        throw new ApiError(500, "Failed to upload avatar");
        
        
    }

    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);
        console.log("Cover image uploaded successfully", coverImage);
        
    } catch (error) {
        console.log("Error uploading coverImage", error);
        throw new ApiError(500, "Failed to upload coverImage");
        
    }

    try {
        const user = await User.create({
            fullname,
            username: username.toLowerCase(),
            email,
            password,
            avatar: avatar?.url,  // save only the url from the cloudinary in the database
            coverImage: coverImage?.url || ""
        })
    
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken" // things you dont want to retrieve from the database to check should be given like this
        )
        if(!createdUser) throw new ApiError(500, "Something went wrong while registering a user");
    
        return res
            .status(201)
            .json(new ApiResponse(201, createdUser, "User registered successfully"));

    } catch (error) {
        console.log("User creation failed.");
        
        if(avatar) await deleteFromCloudinary(avatar.public_id);
        if(coverImage) await deleteFromCloudinary(coverImage.public_id);

        throw new ApiError(500, "Something went wrong while registering a user");

    }

})

const loginUser = asyncHandler(async (req, res) => {
    // get data from the body
    console.log(req.body);
    
    const {username, email, password} = req.body;
    

    if(!email) throw new ApiError(400, "Email is required");
    if(!password) throw new ApiError(400, "Password is required");
    
    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if(email !== user.email) throw new ApiError(404, "Email invalid");

    if(!user) throw new ApiError(404, "User not found");

    // validate password
    const isPasswordValid = await user.isPasswordCorrect(password);
    
    if(!isPasswordValid) throw new ApiError(404, "Invalid password");

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    if(!loggedInUser) throw new ApiError(404, "User not found");

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }
    

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User Logged in successfully"));    
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null,
            }
        },
        {new: true}
    )
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, req.user, "User logged out successfully"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    console.log(incomingRefreshToken);
    
    

    if(!incomingRefreshToken) throw new ApiError(401, "Refresh token is required");

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        console.log(decodedToken._id);
        
        
        const user = await User.findById(decodedToken?._id);
        
        if(!user) throw new ApiError(401, "Invalid Refresh token");

        if(incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Invalid Refresh token");

        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id);
        console.log(newRefreshToken);
        

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }
        return res
            .status(200)
            .cookie("acccessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access and refesh token refreshed successfully"));

    } catch (error) {
        throw new ApiError(500, "Something went wrong while refreshing access token");
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    
    const {oldPassword, newPassword} = req.body;
    console.log(oldPassword);
    
    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    console.log(isPasswordValid);
    
    if(!isPasswordValid) throw new ApiError(401, "Old Password incorrect");

    user.password = newPassword;

    await user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
        
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user details"));

})

const   updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body;
    if(!fullname || !email) throw new ApiError(404, "Full name and email is required");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email.toLowerCase()
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))

})

// maybe give a visit
const updateUserAvatar = asyncHandler(async (req, res) => {
    
    const avatarLocalPath = req.file?.path;
    console.log(avatarLocalPath);
    
    if(!avatarLocalPath) throw new ApiError(400, "File is required");

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url) throw new ApiError(400, "Something went wrong while uploading the avatar");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"));
})

const updateUserCover = asyncHandler(async (req, res) => {
    const coverLocalPath = req.file?.path;
    if(!coverLocalPath) throw new ApiError(400, "File is required");

    const cover = await uploadOnCloudinary(coverLocalPath);
    if(!cover.url) throw new ApiError(400, "Something went wrong while uploading the cover image");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                coverImage: cover.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover image updated successfully"));

})

const getChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params;
    if(!username) throw new ApiError(400, "Username is required");

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscriberTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                    }
                }
            }
        },
        {
            // project only the necessary data
            $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                coverImage: 1,
                email: 1
            }

        }
    ]
    )

    if(!channel?.length) throw new ApiError(400, "Channel not found");

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "Channel profile detched successfully"));

})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "User",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]
    )

    return res
        .status(200)
        .json(new ApiResponse(200, user[0]?.watchHistory, "Watch history fetched successfully"));

})


export {
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
}