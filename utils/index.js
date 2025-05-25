const splitString = (provider) => {

  const image = provider?.split(" ")[0].toLowerCase() || provider?.split("-")[0].toLowerCase() || provider
  return image
}

export {splitString}