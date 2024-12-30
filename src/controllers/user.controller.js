import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";







const registerUser = asyncHandler(async (req, res)=>{
   const {username ,fullname , email, password} = req.body
//    console.log("email :", email)
    if(
        [username,fullname,email,password].some((field)=>field?.trim()=="")
    ){
        throw new ApiError("All fields are required",400)
    }

    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError("Username or email already exists",409)
    }
   
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(500,"Failed to upload avatar")
    }

    const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        username : username.toLowerCase(),
        email,
        password
    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" 
    )

    if(!createdUser){
        throw new ApiError("Failed to create user",500)
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered")
    )

})


export { registerUser }