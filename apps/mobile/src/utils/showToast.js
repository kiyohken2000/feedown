import Toast from 'react-native-toast-message'

const showToast = ({ title, body, type = 'success' }) => {
  Toast.show({
    type,
    text1: title,
    text2: body,
  })
}

const showErrorToast = ({ title, body }) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: body,
  })
}

export { showToast, showErrorToast }