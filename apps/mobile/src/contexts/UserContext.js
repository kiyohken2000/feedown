import React, { createContext, useState, useEffect } from "react";

export const UserContext = createContext();

export const UserContextProvider = (props) => {
  const [user, setUser] = useState('')

  return (
    <UserContext.Provider
      value={{
        user, setUser
      }}
    >
      {props.children}
    </UserContext.Provider>
  )
}