<?php
$metadata['urn:localhost'] = [
    'AssertionConsumerService' => [
        [
            'index' => 1,
            'isDefault' => true,
            'Location' => 'https://localhost/drop-in-tutoring/wp-login.php',
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        ],
    ],
    'SingleLogoutService' => [
        [
            'Location' => 'https://localhost/drop-in-tutoring/wp-login.php',
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        ],
    ],
];
