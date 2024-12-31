import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"





const generateAcessandRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const acessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
       await  user.save({validateBeforeSave:false})

        return {acessToken , refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong")
    }
}

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
const loginUser = asyncHandler(async (req,res)=>{
    const {username , email, password} = req.body
    if(!(username || email)){
        throw new ApiError(400 ,"Username or email is required")
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"Invalid credentials")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401 , "Password is invalid")
    }

    const {acessToken,refreshToken} = await generateAcessandRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200).cookie("acessToken",acessToken , options).cookie("refreshToken",refreshToken,options).json(
        new ApiResponse(200,{
            user : loggedInUser , acessToken , refreshToken
        },
        "User logged In Successfully"
    )
    )
})
const logoutUser = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set :{
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200).clearCookie("acessToken", options).clearCookie("refreshToken",options).json(
        new ApiResponse(200,{},"User logged Out Successfully")
    )

   
})
const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
   try {
     const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET,
         
     )
     const user = await User.findById(decodedToken?._id)
     if(!user){
         throw new ApiError(401,"Invalid refresh token ")
     }
     if(incomingRefreshToken != user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or used ")
     }
 
     const options = {
         httpOnly:true,
         secure:true
     }
     const {acessToken , newRefreshToken} = await generateAcessandRefreshToken(user._id)
 
     return res.status(200).cookie("acessToken" , acessToken,options).cookie("refreshToken" ,newRefreshToken , options).json(
         new ApiResponse(
             200,
             {acessToken , newRefreshToken},
             "AccessToken refreshed successfully"
         )
     )
   } catch (error) {
    throw new ApiError(401 , error?.message || "Invalid refresh token");
   }
})


const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword , newPassword} = req.body

    const user = User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(401,"Old password is incorrect")
    }
    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    )
})


const getCurrentUser = asyncHandler(async (req, res)=>{
    return res.status(200).json(
        200, 
        req.user,
        "current user fetched successfully"
    )
})


const updateAccountDetails = asyncHandler(async (req, res)=>{
    const {fullname,email} = req.body
    if(!fullname && !email){
        throw new ApiError(400,"All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {fullname,email}
        },
        {new : true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    )
})

const updateAvatar = asyncHandler(async (req, res)=>{
const avatarLocalPath = req.file?.path

if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
}
const avatar = uploadOnCloudinary(avatarLocalPath)

if(!avatar.url){
    throw new ApiError(500,"Failed to upload avatar")
}
const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set : {avatar : avatar.url}
    },
    {new : true}
).select("-password")
return res.status(200).json(
    new ApiResponse(
        200,
        user,
        "Avatar updated successfully"
    )
    
)
})
const updateCoverImage = asyncHandler(async (req, res)=>{
    const coverImageLocalPath = req.file?.path
    
    if(!coverImageLocalPath){
        throw new ApiError(400,"coverImage file is missing")
    }
    const avatar = uploadOnCloudinary(coverImageLocalPath)
    
    if(!coverImage.url){
        throw new ApiError(500,"Failed to upload coverImage")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {coverImage : coverImage.url}
        },
        {new : true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "CoverImage updated successfully"
        )
    )

    })






export { registerUser , loginUser,logoutUser,refreshAccessToken , changeCurrentPassword , getCurrentUser  , updateAccountDetails , updateAvatar , updateCoverImage}