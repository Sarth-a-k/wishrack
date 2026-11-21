plugins {
    id("com.android.application")
}

android {
    namespace = "app.wishrack"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.wishrack"
        minSdk = 26
        targetSdk = 36
        versionCode = 6
        versionName = "1.5"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Personal sideloaded app: signed with this computer's debug key so it installs without a store.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
