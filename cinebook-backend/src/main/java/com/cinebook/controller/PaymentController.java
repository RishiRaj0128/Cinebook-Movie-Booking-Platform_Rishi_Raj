package com.cinebook.controller;

import com.cinebook.domain.entity.User;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.model.payment.PaymentRequestRecord;
import com.cinebook.domain.model.payment.TransactionResultRecord;
import com.cinebook.dto.request.PaymentVerifyRequest;
import com.cinebook.dto.request.WalletPaymentRequest;
import com.cinebook.dto.response.ApiResponse;
import com.cinebook.dto.response.PaymentOrderResponse;
import com.cinebook.service.PaymentService;
import com.cinebook.service.idempotency.IdempotencyService;
import com.cinebook.service.ledger.LedgerReconciliationReport;
import com.cinebook.service.ledger.LedgerService;
import com.cinebook.service.payment.PaymentEngineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentEngineService paymentEngineService;
    private final LedgerService ledgerService;
    private final IdempotencyService idempotencyService;

    @PostMapping("/create-order")
    public ResponseEntity<ApiResponse<PaymentOrderResponse>> createOrder(
            @RequestParam UUID bookingId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal User user) {
        PaymentOrderResponse response = idempotencyService.execute(
                idempotencyKey,
                "create-order:" + bookingId + ":" + user.getId(),
                PaymentOrderResponse.class,
                () -> paymentService.createOrder(bookingId, user.getId())
        );
        return ResponseEntity.ok(ApiResponse.ok(response, "Payment order created"));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Boolean>> verifyPayment(
            @Valid @RequestBody PaymentVerifyRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal User user) {
        Boolean success = idempotencyService.execute(
                idempotencyKey,
                request,
                Boolean.class,
                () -> paymentService.verifyAndConfirmPayment(request, user.getId())
        );
        return ResponseEntity.ok(ApiResponse.ok(success, "Payment verified and booking confirmed successfully"));
    }

    @PostMapping("/wallet-pay")
    public ResponseEntity<ApiResponse<TransactionResultRecord>> payWithWallet(
            @Valid @RequestBody WalletPaymentRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal User user) {
        PaymentRequestRecord domainRequest = new PaymentRequestRecord(
                request.getBookingId(),
                user.getId(),
                Money.ofPaise(request.getAmountPaise()),
                "INR",
                "WALLET",
                idempotencyKey,
                null
        );

        TransactionResultRecord result = paymentEngineService.processPayment(domainRequest);
        return ResponseEntity.ok(ApiResponse.ok(result, "Payment processed"));
    }

    @PostMapping("/webhook")
    public ResponseEntity<ApiResponse<Boolean>> handleWebhook(
            @RequestBody String rawPayload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String razorpaySignature,
            @RequestHeader(value = "X-Signature", required = false) String genericSignature) {
        String signature = razorpaySignature != null ? razorpaySignature : genericSignature;
        boolean processed = paymentEngineService.processWebhook(rawPayload, signature);
        return ResponseEntity.ok(ApiResponse.ok(processed, "Webhook processed successfully"));
    }

    @GetMapping("/reconciliation/ledger")
    public ResponseEntity<ApiResponse<LedgerReconciliationReport>> reconcileLedger() {
        LedgerReconciliationReport report = ledgerService.reconcileLedger();
        return ResponseEntity.ok(ApiResponse.ok(report, "Ledger audit report generated"));
    }

    @PostMapping("/reconcile-stuck")
    public ResponseEntity<ApiResponse<Integer>> reconcileStuck(
            @RequestParam(defaultValue = "300") int thresholdSeconds) {
        int resolved = paymentEngineService.reconcileStuckTransactions(thresholdSeconds);
        return ResponseEntity.ok(ApiResponse.ok(resolved, "Reconciliation sweep completed"));
    }
}
