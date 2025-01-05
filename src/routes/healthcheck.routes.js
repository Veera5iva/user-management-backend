import {Router} from "express";
import { healthcheck } from "../controllers/healthcheck.controllers.js";

const router = Router();

router.route("/").get(healthcheck)

// const test = async(req, res) => {
//     return res.status(200).send("Test Ok");
// }

// router.route("/test").get(test);

console.log("healthcheck routes: ok");

export default router;


