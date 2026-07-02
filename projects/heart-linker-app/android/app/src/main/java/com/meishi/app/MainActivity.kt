package com.meishi.app

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.meishi.app.nfc.NfcApdu
import com.meishi.app.nfc.NfcReaderBus
import com.meishi.app.ui.screens.ContactDetailScreen
import com.meishi.app.ui.screens.ContactListScreen
import com.meishi.app.ui.screens.EditProfileScreen
import com.meishi.app.ui.screens.ReceiveScreen
import com.meishi.app.ui.screens.SendScreen
import com.meishi.app.ui.theme.MeishiTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var nfcAdapter: NfcAdapter? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        setContent {
            MeishiTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MeishiNavHost()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // NFCリーダーモード: 相手端末(HCE)をタップしたらセッショントークンを読み取り、
        // Nearby ConnectionsへのハンドオーバートリガーとしてNfcReaderBusへ流す。
        nfcAdapter?.enableReaderMode(
            this,
            { tag: Tag ->
                val isoDep = IsoDep.get(tag) ?: return@enableReaderMode
                try {
                    isoDep.connect()
                    val response = isoDep.transceive(NfcApdu.selectAidCommand())
                    val token = NfcApdu.parseTokenResponse(response)
                    if (token != null) {
                        lifecycleScope.launch { NfcReaderBus.emit(token) }
                    }
                } catch (e: Exception) {
                    // タップが不安定な場合は無視して次のタップを待つ
                } finally {
                    try { isoDep.close() } catch (_: Exception) {}
                }
            },
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableReaderMode(this)
    }
}

private object Routes {
    const val LIST = "list"
    const val EDIT_PROFILE = "edit_profile"
    const val SEND = "send"
    const val RECEIVE = "receive"
    const val CONTACT_DETAIL = "contact_detail/{contactId}"
    fun contactDetail(id: Long) = "contact_detail/$id"
}

@Composable
private fun MeishiNavHost() {
    val navController: NavHostController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.LIST) {
        composable(Routes.LIST) {
            ContactListScreen(
                onEditProfile = { navController.navigate(Routes.EDIT_PROFILE) },
                onSend = { navController.navigate(Routes.SEND) },
                onReceive = { navController.navigate(Routes.RECEIVE) },
                onOpenContact = { id -> navController.navigate(Routes.contactDetail(id)) }
            )
        }
        composable(Routes.EDIT_PROFILE) {
            EditProfileScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SEND) {
            SendScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.RECEIVE) {
            ReceiveScreen(
                onBack = { navController.popBackStack() },
                onReceived = { id ->
                    navController.popBackStack()
                    navController.navigate(Routes.contactDetail(id))
                }
            )
        }
        composable(Routes.CONTACT_DETAIL) { backStackEntry ->
            val contactId = backStackEntry.arguments?.getString("contactId")?.toLongOrNull() ?: 0L
            ContactDetailScreen(contactId = contactId, onBack = { navController.popBackStack() })
        }
    }
}
