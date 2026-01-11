const loginButtonStatus = ({email, password}) => {
  if (!email || !password || password.length < 6) return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(email.trim()) && password.trim() !== '') {
    return true;
  } else {
    return false;
  }
}

export { loginButtonStatus }