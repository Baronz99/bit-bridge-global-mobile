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
        const response = await axios.get(`${base_url + api_route}transactions/user`, {
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


export const createTransaction =  async({
    data,
    token
    }: {
        data: any,
        token: string
    }) => {  
        const formdata = {
            transaction: {
                ...data
            }
        }

        console.log("formdata ===>",formdata)

    try {

        const response = await axios.post(`${base_url + api_route}transactions`, 
            formdata, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": 'application/json', 

            }
        });

        const result = response.data;   

        return result;
    } catch (error: any) {
        if (error?.response) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Something went wrong")
    }
}




export const initiateMonnifyTransaction =  async({
    data,
    token
    }: {
        data: any,
        token: string
    }) => {  
        const formdata = {
            transaction: {
                ...data
            }
        }

    try {

        const response = await axios.post(`${base_url + api_route}transactions/initialize_transaction`, 
            formdata, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": 'application/json', 
            }
        });

        const result = response.data;   

        return result;
    } catch (error: any) {
        if (error?.response) {
            console.log("api error =======>",error.response)
            throw new Error(error.response.data.message);
        }
        throw new Error("Something went wrong")
    }
}
