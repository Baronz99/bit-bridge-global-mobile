import axios from "axios";
import APP_CONFIG from "./baseUrl";

const {base_url, api_route} = APP_CONFIG
export const getProducts = async({
    token,
    params,
}: {
    token: string  ,
    params?: {
        category?: "mobile provider" | "gift card" | "service" | "utility" | "crypto"
        type?: string
    }

}) => {
    try {
        if(!token){
            throw new Error("Token is required")
        }
        const response = await axios.get(`${base_url + api_route}products`, {
            params,
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const {data} = response.data;

        return data;
    } catch (error: any) {
        if (error.response) {
            throw new Error (error.response.data.message || "Something went wrong")
        }
        console.log("first product  error ====> ", error.message)

        throw error.message || "Something went wrong" 
    }
};




export const getProvisions = async({
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
        const response = await axios.get(`${base_url + api_route}provisions`, {
            params,
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const {data} = response.data;

        return data;
    } catch (error: any) {
        if (error.response) {
            throw new Error (error.response.data.message || "Something went wrong")
        }

        throw error.message || "Something went wrong" 
    }
};


export const getProvision = async({id, 
    token

   
}: {
    id: string,
    token: string

}) => {
    try {
   
        const response = await axios.get(`${base_url + api_route}provisions/${id}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const {data} = response.data;

        return data;
    } catch (error: any) {
        if (error.response) {
            console.log("error", error.response.data)
            throw new Error (error.response.data.message || "Something went wrong")
        }

        throw new Error(error.message || "Something went wrong" )
    }
};