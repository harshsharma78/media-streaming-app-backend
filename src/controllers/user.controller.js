import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async userId => {
  try {
    const user = await User.findOne(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false }); // To bypass password requirement

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token",
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Get user details from frontend
  const { fullName, email, password, username } = req.body;

  // Validation - not empty
  if (
    [fullName, email, username, password].some(field => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists: username, email
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser)
    throw new ApiError(409, "User with email or username already exists");

  // Check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

  // Check for images, check for cover image
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage.length > 0
  )
    coverImageLocalPath = req.files?.coverImage[0]?.path;

  // Upload images to cloudinary: avatar and cover image
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar file is required");

  // Create user object - create entry in db
  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // Remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  // Check for user creation
  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering the user");

  // Return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!(username || email))
    throw new ApiError(400, "Username or Email is required!!");

  // Check existing user
  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) throw new ApiError(404, "User does not exist!");

  // Valid Password Check
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials!");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  // Cookies and response
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged In Successfully!",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export { registerUser, loginUser, logoutUser };
