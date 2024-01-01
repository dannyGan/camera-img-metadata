import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ImageBackground } from "react-native"
import { Camera } from "expo-camera"
import * as MediaLibrary from "expo-media-library"
import * as Location from "expo-location"
import MapView, { Marker } from "react-native-maps"
import { Magnetometer } from "expo-sensors"

const CameraScreen = () => {
	const [hasPermission, setHasPermission] = useState(null)
	const [cameraRef, setCameraRef] = useState(null)
	const [capturedImage, setCapturedImage] = useState(null)
	const [imageMetadata, setImageMetadata] = useState(null)
	const [locationPermission, setLocationPermission] = useState(null)
	const [errorMsgLocation, setErrorMsgLocation] = useState(null)
	const [errorMsgWeather, setErrorMsgWeather] = useState(null)
	const [locationInfo, setLocationInfo] = useState(null)
	const [mapRegion, setMapRegion] = useState(null)
	const [weatherInfo, setWeatherInfo] = useState(null)
	const [magneticField, setMagneticField] = useState({ x: 0, y: 0, z: 0 })
	const [compassIsAvailable, setCompassIsAvailable] = useState(false)

	useEffect(() => {
		;(async () => {
			const { status } = await Camera.requestCameraPermissionsAsync()
			setHasPermission(status === "granted")
		})()
	}, [])

	useEffect(() => {
		setMapRegion(locationInfo)
	}, [locationInfo])

	useEffect(() => {
		Magnetometer.isAvailableAsync().then((result) => {
			setCompassIsAvailable(result)
		})

		const subscription = Magnetometer.addListener((data) => {
			setMagneticField(data)
		})

		return () => {
			subscription.remove()
		}
	}, [])

	const takePicture = async () => {
		if (cameraRef) {
			const { status: mediaLibraryStatus } = await MediaLibrary.requestPermissionsAsync()
			if (mediaLibraryStatus !== "granted") {
				alert("Media Library permission not granted")
				return
			}

			const photo = await cameraRef.takePictureAsync()
			setCapturedImage(photo)
			try {
				const asset = await MediaLibrary.createAssetAsync(photo.uri)
				const assetInfo = await MediaLibrary.getAssetInfoAsync(asset)
				setImageMetadata(assetInfo)

				const { status } = await Location.requestForegroundPermissionsAsync()
				if (status === "granted") {
					setLocationPermission(status === "granted")
					const location = await Location.getCurrentPositionAsync({})
					const distanceVisibleInKilometers = 10
					const latitudeDelta = distanceVisibleInKilometers / 111.32
					const longitudeDelta = distanceVisibleInKilometers / (111.32 * Math.cos(location.coords.latitude * (Math.PI / 180)))
					setLocationInfo({
						latitude: location.coords.latitude,
						longitude: location.coords.longitude,
						latitudeDelta,
						longitudeDelta,
					})
					fetchWeatherData(location.coords.latitude, location.coords.longitude)
				} else {
					setLocationPermission(false)
					setErrorMsgLocation("Permission to access location was denied")
				}
			} catch (error) {
				console.error(error)
			}
		}
	}

	const fetchWeatherData = async (lat, long) => {
		try {
			const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,relative_humidity_2m,apparent_temperature&forecast_days=1`)
			if (!response.ok) {
				setErrorMsgWeather("Something wrong")
				throw new Error("Network response was not ok")
			}

			const data = await response.json()

			setWeatherInfo(data)
		} catch (error) {
			console.error("Fetch Error:", error)
			setErrorMsgWeather("Could not get weather data")
		}
	}

	const retakePicture = () => {
		setCapturedImage(null)
		setImageMetadata(null)
		setLocationInfo(null)
		setMapRegion(null)
		setWeatherInfo(null)
		setErrorMsgWeather(null)
	}

	const convertCreationTime = (timestamp) => {
		const date = new Date(timestamp)
		const day = date.getDate().toString().padStart(2, "0")
		const month = (date.getMonth() + 1).toString().padStart(2, "0")
		const year = date.getFullYear()

		return `${day}/${month}/${year}`
	}

	let locationText = (
		<Text>
			{"\n"}
			<Text>Location loading...</Text>
		</Text>
	)
	if (errorMsgLocation) {
		locationText = errorMsgLocation
	} else if (!locationPermission) {
		locationText = (
			<Text>
				{"\n"}
				<Text>Location permission denied</Text>
			</Text>
		)
	} else if (locationInfo !== null && locationPermission) {
		locationText = (
			<Text>
				{"\n"}
				<Text>Latitude: {locationInfo.latitude}</Text>
				{"\n"}
				{"\n"}
				<Text>Longitude: {locationInfo.longitude}</Text>
			</Text>
		)
	}

	let weatherText = (
		<Text>
			{"\n"}
			<Text>Weather loading...</Text>
		</Text>
	)
	if (errorMsgWeather) {
		weatherText = errorMsgWeather
	} else if (weatherInfo !== null) {
		weatherText = (
			<Text>
				{"\n"}
				<Text>Current Temperature: {`${weatherInfo.current.temperature_2m} ${weatherInfo.current_units.temperature_2m}`}</Text>
				{"\n"}
				{"\n"}
				<Text>Apparent Temperature: {`${weatherInfo.current.apparent_temperature} ${weatherInfo.current_units.temperature_2m}`}</Text>
				{"\n"}
				{"\n"}
				<Text>Humidity: {`${weatherInfo.current.relative_humidity_2m} ${weatherInfo.current_units.relative_humidity_2m}`}</Text>
				{"\n"}
				{"\n"}
				<Text>Altitude: {`${weatherInfo.elevation}`}</Text>
			</Text>
		)
	}

	let magneticFieldText = "Magnetic Field: "
	if (compassIsAvailable) {
		magneticFieldText += `X: ${magneticField.x.toFixed(2)}, Y: ${magneticField.y.toFixed(2)}, Z: ${magneticField.z.toFixed(2)}`
	} else {
		magneticFieldText += "Magnetometer not available on this device."
	}

	if (hasPermission === null) {
		return <View />
	}

	if (hasPermission === false) {
		return <Text>No access to camera</Text>
	}

	return (
		<View style={styles.container}>
			{capturedImage ? (
				<View style={styles.preview}>
					<View style={{ height: "50%", width: "100%", padding: 5, flex: 0, alignItems: "center" }}>
						<ImageBackground source={{ uri: capturedImage.uri }} style={styles.previewImage}>
							<View style={styles.watermarkContainer}>
								<Image source={require("./assets/circle_water_mark.png")} style={styles.previewWaterMark} />
							</View>
						</ImageBackground>
						<TouchableOpacity style={styles.buttonRetake} onPress={retakePicture}>
							<Text style={styles.buttonText}>Retake Picture</Text>
						</TouchableOpacity>
					</View>
					{imageMetadata !== null ? (
						<ScrollView style={{ width: "100%" }}>
							<View style={styles.metadataContainer}>
								<Text style={styles.metadataText}>Date: {convertCreationTime(imageMetadata.creationTime)}</Text>
								<Text style={styles.metadataText}>{locationText}</Text>
								<Text style={styles.metadataText}>{weatherText}</Text>
								<Text style={styles.metadataText}>
									{"\n"}
									{magneticFieldText}
								</Text>
								<MapView style={styles.map} region={mapRegion}>
									<Marker coordinate={mapRegion} title="Marker" />
								</MapView>
							</View>
						</ScrollView>
					) : (
						<View>
							<Text>Image data is empty</Text>
						</View>
					)}
				</View>
			) : (
				<Camera
					style={styles.camera}
					type={Camera.Constants.Type.back}
					ref={(ref) => {
						setCameraRef(ref)
					}}
				>
					<View style={styles.buttonContainer}>
						<TouchableOpacity style={styles.buttonTake} onPress={takePicture}>
							<Text style={styles.buttonText}>Take Picture</Text>
						</TouchableOpacity>
					</View>
				</Camera>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		height: "100%",
		backgroundColor: "grey",
	},
	camera: {
		flex: 1,
	},
	preview: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
	},
	previewImage: {
		flex: 1,
		width: "100%",
		height: "100%",
		resizeMode: "cover",
		borderColor: "black",
		borderWidth: 5,
		borderRadius: 10,
		marginTop: 30,
		alignItems: "flex-end",
		justifyContent: "center",
	},
	watermarkContainer: {
		flex: 1,
		width: 40,
		justifyContent: "flex-end",
		alignItems: "center",
	},
	previewWaterMark: {
		justifyContent: "flex-end",
		width: 50,
		height: 50,
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		resizeMode: "contain",
		marginRight: 10,
		borderBottomRightRadius: 10,
		borderTopLeftRadius: 10,
	},
	metadataContainer: {
		alignItems: "center",
	},
	metadataText: {
		fontSize: 16,
	},
	buttonContainer: {
		flex: 1,
		backgroundColor: "transparent",
		flexDirection: "row",
		justifyContent: "center",
	},
	buttonTake: {
		alignSelf: "flex-end",
		alignItems: "center",
		marginBottom: 20,
		backgroundColor: "white",
		borderColor: "black",
		borderWidth: 5,
		borderRadius: 10,
	},
	buttonRetake: {
		alignItems: "center",
		marginBottom: 20,
		marginTop: 20,
		backgroundColor: "white",
		borderColor: "black",
		borderWidth: 5,
		borderRadius: 10,
	},
	buttonText: {
		fontSize: 18,
		color: "black",
		padding: 10,
	},
	map: {
		width: "80%",
		height: 400,
		marginTop: 15,
		marginBottom: 15,
		borderColor: "black",
		borderWidth: 5,
		borderRadius: 10,
	},
})

export default CameraScreen
