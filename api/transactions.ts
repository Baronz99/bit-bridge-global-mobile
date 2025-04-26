import axios from "axios";
import APP_CONFIG from "./baseUrl";
const {base_url, api_route} = APP_CONFIG

export const getTransactions = async({
    token,
    params,
}: {
    token: string  ,
    params?: {
        category?: string
        type?: string
    }

}) => {
    try {
        if(!token){
            throw new Error("Token is required")
        }
        const response = await axios.get(`${base_url + api_route}transactions`, {
            params,
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = response.data;

        return data;
    } catch (error: any) {
        if (error.response) {
            throw new Error (error.response.data.message || "Something went wrong")
        }

        throw error.message || "Something went wrong" 
    }
};
