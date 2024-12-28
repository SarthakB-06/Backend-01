// const asyncHandler = () => {}


const asyncHandler = (fn) => async (req,res,next) => {
    try {
        
    } catch (error) {
        res.send(err.code || 500).json({
            success: false,
            message:err.message
        })
    }
}


export {asyncHandler}