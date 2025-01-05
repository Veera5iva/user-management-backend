import mongoose, {Schema} from "mongoose";
// instead of loading all data at once we can use pagination to load small data chucknsp
// works like load more - only when you go to 2nd page other data will be loaded.
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";


const videoSchema = new Schema({
    videoFile: {
        type: String, // cloudinary URL
        requierd: true
    },
    thumbnail: {
        type: String, // cloudinary URL
        requierd: true
    },
    title: {
        type: String, 
        requierd: true
    },
    description: {
        type: String, 
        requierd: true
    },
    duration: {
        type: Number,
        requierd: true
    },
    views: {
        type: Number,
        default: 0
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
},
{
    timestamps: true
}
)
videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema);