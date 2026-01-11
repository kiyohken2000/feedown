import React from 'react'
import { useSelector } from 'react-redux'
import Main from './navigation'
import Loading from '../scenes/loading/Loading'

export default function Routes() {
  const { checked } = useSelector((state) => state.app)

  // rendering
  if (!checked) {
    return (
      <Loading/>
    )
  }

  return (
    <Main />
  )
}
